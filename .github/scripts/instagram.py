#!/usr/bin/env python3
"""Traz as publicações do Instagram para dentro da cópia publicada.

Corre durante o build, não no browser: as imagens são descarregadas e passam a
ser servidas pelo próprio site. Assim o visitante não faz um único pedido à
Meta, não recebe cookies de terceiros e a galeria não precisa de consentimento.

Usa os secrets do repositório: de preferência FB_USER_TOKEN, com o qual procura
entre as páginas geridas a que tem a conta Instagram ligada; na falta dele (ou se
falhar), FB_PAGE_ACCESS_TOKEN ou IG_TOKEN. Sem nenhum não falha — deixa a grelha vazia e
a secção mostra só a chamada ao perfil.

Se a Meta falhar (token invalidado, imagens recusadas...), reutiliza a galeria
da última publicação que funcionou, guardada na pasta IG_CACHE pela cache do
GitHub Actions. O resultado de cada corrida fica em instagram-estado.txt, na
raiz da cópia publicada, para se ver o que aconteceu sem entrar no GitHub — o
ficheiro nunca leva tokens nem URLs de pedidos.
"""
import datetime
import html
import json
import os
import pathlib
import shutil
import sys
import urllib.error
import urllib.request

from lib.meta_api import NEGOCIO, PAGINA, pedir

QUANTOS = 6
CAMPOS = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp'
ALVO = '<div class="carousel-inner ig-grid" data-instagram-grid></div>'

relatorio = []


def nota(msg: str) -> None:
    print(msg)
    relatorio.append(msg.strip())


def detalhe(erro: Exception) -> str:
    """Descreve um erro sem expor o pedido: o URL leva o token."""
    if isinstance(erro, urllib.error.HTTPError):
        try:
            meta = json.loads(erro.read().decode('utf-8', 'replace')).get('error', {})
            return 'HTTP %s: %s' % (erro.code, meta.get('message', erro.reason))
        except (ValueError, OSError, AttributeError):
            return 'HTTP %s: %s' % (erro.code, erro.reason)
    if isinstance(erro, urllib.error.URLError):
        return 'rede: %s' % erro.reason
    return '%s: %s' % (type(erro).__name__, erro)


def conta_instagram(token: str) -> str:
    """Descobre o id da conta Instagram ligada à página do token.

    Com um token de página, /me é a própria página — seja ela qual for, porque a conta
    Instagram já mudou de página uma vez. A descoberta automática pela página vem sempre
    primeiro: é o caminho testado e fiável. INSTAGRAM_ACCOUNT_ID só serve de reserva manual
    se esse caminho não resolver — assim um valor errado nesse secret não consegue, sozinho,
    calar a galeria (como já aconteceu).
    """
    pagina = {}
    try:
        pagina = pedir('me', token, fields='id,name,instagram_business_account')
        conta = pagina.get('instagram_business_account')
        if conta:
            nota('  página "%s" -> conta Instagram %s' % (pagina.get('name'), conta['id']))
            return conta['id']
        # A Meta respondeu, mas a página deixou de ter uma conta Instagram profissional ligada
        nota('  a página "%s" não tem nenhuma conta Instagram profissional ligada' % pagina.get('name'))
    except urllib.error.HTTPError as erro:
        # também acontece com um token que não é de página: o campo não existe
        nota('  página indisponível (%s), a tentar alternativas' % detalhe(erro))

    directo = os.environ.get('INSTAGRAM_ACCOUNT_ID', '').strip()
    if directo:
        nota('  conta Instagram %s (por INSTAGRAM_ACCOUNT_ID)' % directo)
        return directo

    # Recurso: token emitido diretamente para a conta Instagram, sem passar pela página.
    # Se /me já respondeu como página, não é esse o caso.
    if not pagina:
        eu = pedir('me', token, fields='id,username')
        if eu.get('id'):
            nota('  token direto da conta Instagram %s (@%s)' % (eu['id'], eu.get('username', '?')))
            return eu['id']

    raise ValueError('não foi possível identificar a conta Instagram a partir do token')


LIMITE = 320


def legenda_ajustada(caption: str) -> str:
    """Corta a legenda ao que cabe no slide.

    As legendas do Instagram não têm limite prático: as compridas empurravam o
    texto para fora do cartão. Corta-se preferindo o fim de um parágrafo
    inteiro e, na falta dele, uma fronteira de palavra. A publicação completa
    fica a um clique, porque a imagem liga ao Instagram.
    """
    texto = (caption or '').strip()
    if len(texto) <= LIMITE:
        return texto

    corte = texto[:LIMITE]
    paragrafo = corte.rfind('\n\n')
    if paragrafo > LIMITE * 0.55:
        return corte[:paragrafo].rstrip() + ' […]'
    return corte.rsplit(' ', 1)[0].rstrip(' ,.;:–—') + ' […]'


def descarregar(url: str, destino: pathlib.Path) -> bool:
    try:
        pedido = urllib.request.Request(url, headers={'User-Agent': 'artvisao-site/1.0'})
        with urllib.request.urlopen(pedido, timeout=30) as r:
            destino.write_bytes(r.read())
        return True
    except (urllib.error.URLError, OSError) as erro:
        nota('  falhou a imagem %s: %s' % (destino.name, detalhe(erro)))
        return False


def paginas(token_utilizador: str) -> list:
    """As páginas a que o token de utilizador dá acesso, cada uma com o seu token e a conta
    Instagram que tiver ligada.

    /me/accounts lista as páginas do perfil; as dos portfólios empresariais só aparecem em
    /{portfólio}/owned_pages ou client_pages. Consulta-se cada portfólio a que o utilizador
    pertence (mais o NEGOCIO conhecido) e juntam-se as listas, sem repetidos. Os tokens das
    páginas ficam só em memória — nunca vão para o relatório.
    """
    campos = 'id,name,access_token,instagram_business_account{id,username}'
    try:
        negocios = [n['id'] for n in pedir('me/businesses', token_utilizador, fields='id', limit=50).get('data', [])]
    except urllib.error.HTTPError as erro:
        nota('  me/businesses indisponível (%s)' % detalhe(erro))
        negocios = []
    fontes = ['me/accounts']
    for negocio in dict.fromkeys(negocios + [NEGOCIO]):
        fontes += ['%s/owned_pages' % negocio, '%s/client_pages' % negocio]

    vistas = {}
    for caminho in fontes:
        try:
            for pagina in pedir(caminho, token_utilizador, fields=campos, limit=50).get('data', []):
                vistas.setdefault(pagina['id'], pagina)
        except urllib.error.HTTPError as erro:
            nota('  %s indisponível (%s)' % (caminho, detalhe(erro)))
    return list(vistas.values())


def escolher_pagina(lista: list):
    """A página com conta Instagram ligada: a do costume (PAGINA) se ainda a tiver, senão
    a primeira que a tiver. Regista todas, para se perceber o que mudou do lado da Meta."""
    for pagina in lista:
        conta = pagina.get('instagram_business_account')
        ligacao = '@%s' % conta.get('username', '?') if conta else 'sem Instagram'
        nota('  página "%s" (%s): %s' % (pagina.get('name'), pagina['id'], ligacao))
    com_instagram = [p for p in lista if p.get('instagram_business_account') and p.get('access_token')]
    habitual = [p for p in com_instagram if p['id'] == PAGINA]
    return (habitual or com_instagram or [None])[0]


def galeria(raiz: pathlib.Path, token: str, conta: str = '') -> str:
    conta = conta or conta_instagram(token)
    media = pedir('%s/media' % conta, token, fields=CAMPOS, limit=QUANTOS).get('data', [])

    pasta = raiz / 'assets' / 'instagram'
    pasta.mkdir(parents=True, exist_ok=True)

    slides = []
    for item in media:
        # nos vídeos media_url é o ficheiro de vídeo; a miniatura é que serve
        origem = item.get('thumbnail_url') if item.get('media_type') == 'VIDEO' else item.get('media_url')
        if not origem:
            continue
        nome = '%s.jpg' % item['id']
        if not descarregar(origem, pasta / nome):
            continue
        # Bootstrap exige exatamente um .active — é sempre o primeiro slide que se descarrega
        ativo = ' active' if not slides else ''
        legenda = html.escape(legenda_ajustada(item.get('caption')))
        slides.append(
            '<div class="carousel-item%s">'
            '<div class="ig-slide">'
            '<a class="ig-slide-media" href="%s" target="_blank" rel="noopener noreferrer">'
            '<img src="assets/instagram/%s" alt="Publicação do Instagram Art\'Visão" loading="lazy" width="400" height="400"/></a>'
            '<p class="ig-caption">%s</p>'
            '</div></div>'
            % (ativo, html.escape(item['permalink']), nome, legenda)
        )

    nota('  %d publicações prontas' % len(slides))
    return '\n'.join(slides)


def obter(raiz: pathlib.Path) -> str:
    # Com o token de utilizador (renovado todos os meses pela Action renovar-token), procura-se
    # a página que tem o Instagram ligado, em vez de depender de uma página fixa.
    utilizador = os.environ.get('FB_USER_TOKEN', '').strip()
    if utilizador:
        nota('  a procurar a página com Instagram (FB_USER_TOKEN)')
        try:
            pagina = escolher_pagina(paginas(utilizador))
        except (urllib.error.URLError, KeyError, ValueError) as erro:
            nota('  não foi possível listar as páginas: %s' % detalhe(erro))
            pagina = None
        if pagina:
            conta = pagina['instagram_business_account']
            nota('  a usar a página "%s" -> @%s' % (pagina.get('name'), conta.get('username', '?')))
            try:
                return galeria(raiz, pagina['access_token'], conta['id'])
            except (urllib.error.URLError, KeyError, ValueError) as erro:
                nota('  Instagram indisponível: %s' % detalhe(erro))
                return ''
        nota('  nenhuma das páginas tem uma conta Instagram ligada')

    # Sem token de utilizador (ou sem resultado com ele): os tokens diretos, como antes.
    # O token de página não expira; o de utilizador dura 60 dias. Prefere-se o primeiro.
    token = ''
    for nome in ('FB_PAGE_ACCESS_TOKEN', 'IG_TOKEN'):
        token = os.environ.get(nome, '').strip()
        if token:
            nota('  a usar %s' % nome)
            break
    if not token:
        nota('  sem token configurado')
        return ''

    try:
        return galeria(raiz, token)
    except (urllib.error.URLError, KeyError, ValueError) as erro:
        # uma falha da API não pode deitar abaixo a publicação do site
        nota('  Instagram indisponível: %s' % detalhe(erro))
        return ''


def guardar_cache(cache: pathlib.Path, raiz: pathlib.Path, grelha: str) -> None:
    """Guarda a galeria que funcionou, para uma publicação futura a poder reutilizar."""
    shutil.rmtree(cache, ignore_errors=True)
    (cache / 'instagram').mkdir(parents=True)
    for imagem in (raiz / 'assets' / 'instagram').glob('*.jpg'):
        shutil.copy2(imagem, cache / 'instagram' / imagem.name)
    (cache / 'galeria.html').write_text(grelha, encoding='utf-8')


def ler_cache(cache: pathlib.Path, raiz: pathlib.Path) -> str:
    """Repõe a última galeria que funcionou; devolve '' se ainda não houver nenhuma."""
    guardada = cache / 'galeria.html'
    if not guardada.is_file():
        return ''
    pasta = raiz / 'assets' / 'instagram'
    pasta.mkdir(parents=True, exist_ok=True)
    for imagem in (cache / 'instagram').glob('*.jpg'):
        shutil.copy2(imagem, pasta / imagem.name)
    return guardada.read_text(encoding='utf-8')


def injetar(raiz: pathlib.Path, grelha: str) -> None:
    for pagina in sorted(raiz.glob('*.html')):
        texto = pagina.read_text(encoding='utf-8')
        novo = texto.replace(ALVO, '<div class="carousel-inner ig-grid" data-instagram-grid>\n%s\n</div>' % grelha)
        if novo != texto:
            pagina.write_text(novo, encoding='utf-8')
            nota('  %s preenchida' % pagina.name)


def escrever_estado(raiz: pathlib.Path) -> None:
    quando = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    (raiz / 'instagram-estado.txt').write_text(
        'Galeria do Instagram, publicação de %s\n%s\n' % (quando, '\n'.join(relatorio)),
        encoding='utf-8')


def main() -> None:
    raiz = pathlib.Path(sys.argv[1])
    cache = pathlib.Path(os.environ['IG_CACHE']) if os.environ.get('IG_CACHE') else None
    try:
        grelha = obter(raiz)
        if grelha and cache:
            guardar_cache(cache, raiz, grelha)
        elif not grelha and cache:
            grelha = ler_cache(cache, raiz)
            if grelha:
                nota('  reutilizada a galeria da última publicação que funcionou')
        if grelha:
            injetar(raiz, grelha)
        else:
            nota('  galeria fica vazia')
    finally:
        escrever_estado(raiz)


if __name__ == '__main__':
    main()

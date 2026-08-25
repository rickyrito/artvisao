#!/usr/bin/env python3
"""Traz as publicações do Instagram para dentro da cópia publicada.

Corre durante o build, não no browser: as imagens são descarregadas e passam a
ser servidas pelo próprio site. Assim o visitante não faz um único pedido à
Meta, não recebe cookies de terceiros e a galeria não precisa de consentimento.

Precisa da variável de ambiente IG_TOKEN (secret do repositório). Sem ela não
falha — deixa a grelha vazia e a secção mostra só a chamada ao perfil.
"""
import html
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

API = 'https://graph.facebook.com/v21.0'
QUANTOS = 6
CAMPOS = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp'


def pedir(caminho: str, token: str, **params) -> dict:
    params['access_token'] = token
    url = '%s/%s?%s' % (API, caminho, urllib.parse.urlencode(params))
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


# A página do Facebook a que a conta Instagram está ligada. Não é segredo — o id
# é público — e fica aqui fixo porque /me/accounts devolve vazio: a página
# pertence ao portfólio de negócio Art'Visão, não à conta pessoal que autoriza.
PAGINA = '2183263071989329'


def conta_instagram(token: str) -> str:
    """Descobre o id da conta Instagram ligada à página.

    A descoberta automática pela página vem sempre primeiro: é o caminho testado e fiável.
    INSTAGRAM_ACCOUNT_ID só serve de reserva manual se esse caminho não resolver — assim um
    valor errado nesse secret não consegue, sozinho, calar a galeria (como já aconteceu).
    """
    try:
        pagina = pedir(PAGINA, token, fields='name,instagram_business_account')
        conta = pagina.get('instagram_business_account')
        if conta:
            print('  página "%s" -> conta Instagram %s' % (pagina.get('name'), conta['id']))
            return conta['id']
    except urllib.error.HTTPError as erro:
        print('  página indisponível (%s), a tentar alternativas' % erro.code)

    directo = os.environ.get('INSTAGRAM_ACCOUNT_ID', '').strip()
    if directo:
        print('  conta Instagram %s (por INSTAGRAM_ACCOUNT_ID)' % directo)
        return directo

    # Recurso: token emitido diretamente para a conta Instagram, sem passar pela página
    eu = pedir('me', token, fields='id,username')
    if eu.get('id'):
        print('  token direto da conta Instagram %s (@%s)' % (eu['id'], eu.get('username', '?')))
        return eu['id']

    raise SystemExit('  não foi possível identificar a conta Instagram a partir do token')


def legenda_curta(caption: str) -> str:
    """A legenda serve de texto alternativo: sem hashtags, sem quebras, curta."""
    texto = re.sub(r'#\w+', '', caption or '').replace('\n', ' ')
    texto = re.sub(r'\s+', ' ', texto).strip()
    if len(texto) > 110:
        texto = texto[:110].rsplit(' ', 1)[0] + '…'
    return texto or 'Publicação da Art\'Visão no Instagram'


def descarregar(url: str, destino: pathlib.Path) -> bool:
    try:
        pedido = urllib.request.Request(url, headers={'User-Agent': 'artvisao-site/1.0'})
        with urllib.request.urlopen(pedido, timeout=30) as r:
            destino.write_bytes(r.read())
        return True
    except (urllib.error.URLError, OSError) as erro:
        print('  falhou a imagem %s: %s' % (destino.name, erro))
        return False


def galeria(raiz: pathlib.Path, token: str) -> str:
    conta = conta_instagram(token)
    media = pedir('%s/media' % conta, token, fields=CAMPOS, limit=QUANTOS).get('data', [])

    pasta = raiz / 'assets' / 'instagram'
    pasta.mkdir(parents=True, exist_ok=True)

    tiles = []
    for item in media:
        # nos vídeos media_url é o ficheiro de vídeo; a miniatura é que serve
        origem = item.get('thumbnail_url') if item.get('media_type') == 'VIDEO' else item.get('media_url')
        if not origem:
            continue
        nome = '%s.jpg' % item['id']
        if not descarregar(origem, pasta / nome):
            continue
        tiles.append(
            '<a class="ig-item" href="%s" target="_blank" rel="noopener noreferrer">'
            '<img src="assets/instagram/%s" alt="%s" loading="lazy" width="400" height="400"/></a>'
            % (html.escape(item['permalink']), nome, html.escape(legenda_curta(item.get('caption'))))
        )

    print('  %d publicações prontas' % len(tiles))
    return '\n'.join(tiles)


def main() -> None:
    raiz = pathlib.Path(sys.argv[1])
    # O token de página não expira; o de utilizador dura 60 dias. Prefere-se o primeiro.
    token = ''
    for nome in ('FB_PAGE_ACCESS_TOKEN', 'IG_TOKEN'):
        token = os.environ.get(nome, '').strip()
        if token:
            print('  a usar %s' % nome)
            break
    if not token:
        print('  sem token configurado: galeria fica vazia')
        return

    try:
        grelha = galeria(raiz, token)
    except (urllib.error.URLError, KeyError, ValueError) as erro:
        # uma falha da API não pode deitar abaixo a publicação do site
        print('  Instagram indisponível, galeria fica vazia: %s' % erro)
        return

    if not grelha:
        return

    for pagina in sorted(raiz.glob('*.html')):
        texto = pagina.read_text(encoding='utf-8')
        novo = texto.replace('<div class="ig-grid" data-instagram-grid></div>',
                             '<div class="ig-grid" data-instagram-grid>\n%s\n</div>' % grelha)
        if novo != texto:
            pagina.write_text(novo, encoding='utf-8')
            print('  %s preenchida' % pagina.name)


if __name__ == '__main__':
    main()

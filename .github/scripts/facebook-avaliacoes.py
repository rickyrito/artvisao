#!/usr/bin/env python3
"""Traz avaliações reais da Página do Facebook para dentro da cópia publicada.

Corre durante o build, não no browser — mesma filosofia do instagram.py: sem
pedidos à Meta nem cookies de terceiros para quem visita o site.

Precisa de FB_PAGE_ACCESS_TOKEN (secret do repositório) com a permissão
pages_read_user_content, além das já usadas para o Instagram. Sem token, ou se
a Meta não devolver nenhuma avaliação com texto, a secção de Clientes fica
com os testemunhos escritos que já lá estão — nunca some conteúdo.
"""
import html
import os
import pathlib
import re
import sys
import urllib.error

from lib.meta_api import PAGINA, pedir

QUANTAS = 6
CAMPOS = 'reviewer,rating,review_text,created_time,recommendation_type'

MARCA_INICIO = '<!-- fb-reviews:start -->'
MARCA_FIM = '<!-- fb-reviews:end -->'


def estrelas(rating) -> str:
    """Nem todas as avaliações têm rating de 1-5 — muitas regiões só têm
    recomendação sim/não. Sem rating numérico, não se inventam estrelas."""
    try:
        n = int(rating)
    except (TypeError, ValueError):
        return ''
    n = max(0, min(5, n))
    return '★' * n + '☆' * (5 - n)


def data_curta(created_time: str) -> str:
    # "2026-03-14T10:22:31+0000" -> "março de 2026"
    meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
             'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    m = re.match(r'(\d{4})-(\d{2})-\d{2}', created_time or '')
    if not m:
        return ''
    ano, mes = m.group(1), int(m.group(2))
    return '%s de %s' % (meses[mes - 1], ano)


def avaliacoes(token: str) -> str:
    dados = pedir('%s/ratings' % PAGINA, token, fields=CAMPOS, limit=QUANTAS).get('data', [])

    tiles = []
    for item in dados:
        texto = (item.get('review_text') or '').strip()
        if not texto:
            continue  # recomendação sem texto não dá um testemunho legível

        nome = item.get('reviewer', {}).get('name') or 'Cliente Art\'Visão'
        marcas = estrelas(item.get('rating'))
        quando = data_curta(item.get('created_time'))

        icone = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" '
            'fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" '
            'stroke-linejoin="round" class="text-sky" aria-hidden="true">'
            '<use href="#icon-sparkle"></use></svg>'
        )
        tiles.append(
            '<div class="col"><figure class="bg-card border border-ink-10 rounded-4 p-4 h-100 shadow-sm">'
            '%s%s'
            '<blockquote class="testimonial-quote">%s</blockquote>'
            '<figcaption class="border-top border-ink-10 pt-3 mt-3 testimonial-caption">'
            '<div class="testimonial-author">%s</div>'
            '<div class="text-soft-ink-muted">%s</div>'
            '</figcaption></figure></div>'
            % (
                icone,
                '<div class="review-stars" aria-hidden="true">%s</div>' % marcas if marcas else '',
                html.escape(texto),
                html.escape(nome),
                html.escape(quando),
            )
        )

    print('  %d avaliações com texto' % len(tiles))
    return '\n'.join(tiles)


def main() -> None:
    raiz = pathlib.Path(sys.argv[1])
    token = os.environ.get('FB_PAGE_ACCESS_TOKEN', '').strip()
    if not token:
        print('  sem FB_PAGE_ACCESS_TOKEN: mantêm-se os testemunhos escritos')
        return

    try:
        grelha = avaliacoes(token)
    except (urllib.error.URLError, KeyError, ValueError) as erro:
        # uma falha da API não pode deitar abaixo a publicação do site
        print('  avaliações indisponíveis, mantêm-se os testemunhos escritos: %s' % erro)
        return

    if not grelha:
        return

    padrao = re.compile(re.escape(MARCA_INICIO) + r'.*?' + re.escape(MARCA_FIM), re.S)
    substituto = '%s\n%s\n%s' % (MARCA_INICIO, grelha, MARCA_FIM)

    for pagina in sorted(raiz.glob('*.html')):
        texto = pagina.read_text(encoding='utf-8')
        novo, trocas = padrao.subn(substituto, texto, count=1)
        if trocas and novo != texto:
            pagina.write_text(novo, encoding='utf-8')
            print('  %s preenchida' % pagina.name)


if __name__ == '__main__':
    main()

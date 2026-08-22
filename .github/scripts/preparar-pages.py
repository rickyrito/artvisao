#!/usr/bin/env python3
"""Prepara a cópia que vai para o GitHub Pages.

O Pages só serve ficheiros estáticos, por isso o formulário de contacto — que
depende do contact.php — é retirado apenas desta cópia. O código continua no
repositório para o dia em que o site for para um alojamento com PHP.

Esta é ainda uma publicação de teste, a par do site em produção em
www.artvisao.pt: leva noindex e robots.txt a bloquear, para não haver duas
cópias do mesmo conteúdo indexadas.
"""
import pathlib
import re
import sys

NOINDEX = '<meta name="robots" content="noindex,nofollow"/>\n'


def tirar_formulario(html: str) -> str:
    inicio = html.find('<div class="contact-block')
    if inicio == -1:
        return html
    fim_form = html.find('</form>', inicio)
    if fim_form == -1:
        raise SystemExit('bloco de contacto sem </form>: verificar preparar-pages.py')
    # depois de </form> fecham-se, por esta ordem: coluna, linha e o próprio bloco
    fim = fim_form + len('</form>')
    for _ in range(3):
        fim = html.index('</div>', fim) + len('</div>')
    return html[:inicio] + html[fim:].lstrip('\n')


def preparar(raiz: pathlib.Path) -> None:
    (raiz / 'contact.php').unlink(missing_ok=True)
    (raiz / '.nojekyll').touch()
    (raiz / 'robots.txt').write_text(
        '# Publicação de teste. O site a indexar é https://www.artvisao.pt/\n'
        'User-agent: *\nDisallow: /\n', encoding='utf-8')

    for pagina in sorted(raiz.glob('*.html')):
        html = pagina.read_text(encoding='utf-8')
        original = html

        html = tirar_formulario(html)
        # sem formulário, os CTA que lá apontavam passam a levar aos contactos
        html = html.replace('href="#marcacao"', 'href="#visita"')
        if 'name="robots"' not in html:
            html = html.replace('<meta charset="utf-8"/>\n', '<meta charset="utf-8"/>\n' + NOINDEX, 1)

        pagina.write_text(html, encoding='utf-8')
        print('%-22s %s' % (pagina.name, 'alterada' if html != original else 'sem alterações'))


if __name__ == '__main__':
    preparar(pathlib.Path(sys.argv[1]))

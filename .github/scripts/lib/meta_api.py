"""Wrapper mínimo à Graph API da Meta, usado pelo instagram.py durante o build
para trazer conteúdo real da Meta para dentro da cópia estática, em vez de o
carregar ao vivo no browser do visitante.
"""
import json
import urllib.parse
import urllib.request

API = 'https://graph.facebook.com/v21.0'

# A Página do Facebook a que a conta Instagram estava ligada quando isto foi montado.
# Não é segredo — o id é público. O instagram.py prefere-a, mas procura noutras páginas
# se ela deixar de ter a conta Instagram (já aconteceu: ficou sem ligação em 2026-09-24).
PAGINA = '2183263071989329'

# O portfólio empresarial (Business Manager) da Art'Visão. As páginas que lhe pertencem
# só aparecem em /{portfólio}/owned_pages, não em /me/accounts.
NEGOCIO = '149338662736129'


def pedir(caminho: str, token: str, **params) -> dict:
    params['access_token'] = token
    url = '%s/%s?%s' % (API, caminho, urllib.parse.urlencode(params))
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)

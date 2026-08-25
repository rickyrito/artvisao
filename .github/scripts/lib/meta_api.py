"""Wrapper mínimo à Graph API da Meta, partilhado pelos scripts do build
(instagram.py, facebook-avaliacoes.py) que trazem conteúdo real da Meta para
dentro da cópia estática, em vez de o carregar ao vivo no browser do visitante.
"""
import json
import urllib.parse
import urllib.request

API = 'https://graph.facebook.com/v21.0'

# A Página do Facebook a que a conta Instagram está ligada. Não é segredo — o id
# é público — e fica aqui fixo porque /me/accounts devolve vazio: a página
# pertence ao portfólio de negócio Art'Visão, não à conta pessoal que autoriza.
PAGINA = '2183263071989329'


def pedir(caminho: str, token: str, **params) -> dict:
    params['access_token'] = token
    url = '%s/%s?%s' % (API, caminho, urllib.parse.urlencode(params))
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)

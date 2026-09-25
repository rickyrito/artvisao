#!/usr/bin/env python3
"""Renova o token de utilizador de longa duração da Meta antes que expire — é com
ele que a galeria do Instagram encontra a página e a conta Instagram.

O token de utilizador dura 60 dias, mas pode trocar-se por um novo de 60 dias
enquanto ainda for válido. Corre uma vez por mês via
.github/workflows/renovar-token.yml, bem dentro dessa janela — sem isto, o
token expira sozinho ao fim de dois meses e a galeria fica vazia sem aviso
(foi o que aconteceu em 2026-08).

Atualiza os secrets FB_USER_TOKEN e, como reserva, FB_PAGE_ACCESS_TOKEN no
próprio repositório, através do GitHub CLI (já vem instalado nos runners),
usando o GH_PAT como credencial.
"""
import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request

import instagram  # reutiliza a procura da página que tem o Instagram ligado
from lib.meta_api import API


def trocar_por_novo(app_id: str, app_secret: str, token_atual: str) -> str:
    """Troca um token de utilizador ainda válido por um novo, com mais 60 dias."""
    params = {
        'grant_type': 'fb_exchange_token',
        'client_id': app_id,
        'client_secret': app_secret,
        'fb_exchange_token': token_atual,
    }
    url = '%s/oauth/access_token?%s' % (API, urllib.parse.urlencode(params))
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)['access_token']


def definir_secret(nome: str, valor: str) -> None:
    subprocess.run(['gh', 'secret', 'set', nome, '--body', valor], check=True)


def main() -> None:
    app_id = os.environ['META_APP_ID']
    app_secret = os.environ['META_APP_SECRET']
    token_atual = os.environ['FB_USER_TOKEN']

    novo_token = trocar_por_novo(app_id, app_secret, token_atual)
    # Guarda-se já: é o token que não pode expirar. O resto é secundário.
    definir_secret('FB_USER_TOKEN', novo_token)
    print('  token de utilizador renovado e guardado')

    # O token de página é só uma reserva (o instagram.py encontra a página sozinho com o
    # token de utilizador). Atualiza-se se houver página com Instagram, sem deixar que uma
    # falha aqui estrague a renovação.
    try:
        pagina = instagram.escolher_pagina(instagram.paginas(novo_token))
    except (urllib.error.URLError, KeyError, ValueError) as erro:
        print('  não foi possível listar as páginas: %s' % instagram.detalhe(erro))
        pagina = None
    if pagina:
        definir_secret('FB_PAGE_ACCESS_TOKEN', pagina['access_token'])
        print('  token de página atualizado ("%s")' % pagina.get('name'))
    else:
        print('  nenhuma página com Instagram: FB_PAGE_ACCESS_TOKEN fica como estava')


if __name__ == '__main__':
    main()

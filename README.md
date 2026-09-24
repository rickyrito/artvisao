# artvisao

Site da óptica Art'Visão (Castelo Branco e Soito). HTML, CSS e JavaScript
sem build, com Bootstrap 5.3 carregado da CDN.

## Estrutura

- `artvisao/` — o site. É esta pasta que vai para o alojamento.
  - `index.html`, `faqs.html`, `links.html`, `unidade-movel.html`
  - `css/styles.css` — estilos próprios, por cima do Bootstrap
  - `js/` — `i18n.js` (PT/FR/EN), `main.js`, `search.js`, `consent.js`, `contact.js`
  - `contact.php` — envia o formulário de contacto por email (precisa de PHP 8)
  - `assets/` — imagens; os logótipos das marcas estão em `assets/brands/`
- `.github/` — publicação de teste no GitHub Pages e scripts de apoio

## Publicação

- **Produção** — `www.artvisao.pt`: sobe-se o conteúdo de `artvisao/` para o
  alojamento. Este repositório não publica lá automaticamente.
- **Teste** — GitHub Pages: cada push para `main` publica uma cópia
  (`.github/workflows/pages.yml`). Essa cópia leva `noindex`, fica sem o
  formulário de contacto (o Pages não corre PHP) e traz as últimas
  publicações do Instagram (`.github/scripts/instagram.py`).

## Instagram

A galeria é preenchida durante a publicação, com o token da Meta guardado nos
secrets do repositório. A Action `renovar-token.yml` renova-o no dia 1 de cada
mês. Secrets usados: `FB_USER_TOKEN`, `FB_PAGE_ACCESS_TOKEN`, `META_APP_ID`,
`META_APP_SECRET` e `GH_PAT`.

## Acrescentar uma marca

1. Guardar o logótipo em `artvisao/assets/brands/` (SVG de preferência;
   PNG até ~480px de largura).
2. Copiar uma das linhas da lista `.brand-grid` em `index.html` e trocar o
   `href`, o `src`, o `alt` e o nome.

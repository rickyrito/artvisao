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

Os `<link>` e `<script>` do CSS e do JS levam `?v=AAAAMMDD` nas quatro
páginas. Ao publicar alterações ao `styles.css` ou aos scripts, atualizar essa
data em todas, para os browsers não continuarem a usar a versão antiga em cache.

## Produção

www.artvisao.pt é publicado pela Action **Publicar em produção**
(`producao.yml`), só quando se corre à mão:

1. Em *Settings → Secrets and variables → Actions*, criar os secrets
   `FTP_SERVER`, `FTP_USERNAME` e `FTP_PASSWORD`, com os dados da conta FTP do
   alojamento.
2. Correr a Action no modo **testar ligação**: confirma os dados e mostra as
   pastas do servidor.
3. No separador *Variables*, criar `FTP_DIR` com a pasta do site (por exemplo
   `public_html`).
4. Correr no modo **publicar**.

A cópia de produção leva o formulário de contacto (`contact.php`, que precisa
de PHP 8) e a galeria do Instagram. No servidor não se apaga nada, exceto as
imagens de publicações do Instagram que saíram da galeria.

## Instagram

A galeria é preenchida durante a publicação, com o token da Meta guardado nos
secrets do repositório. A Action `renovar-token.yml` renova-o no dia 1 de cada
mês. Secrets usados: `FB_USER_TOKEN`, `FB_PAGE_ACCESS_TOKEN`, `META_APP_ID`,
`META_APP_SECRET` e `GH_PAT`.

O resultado de cada publicação fica em `instagram-estado.txt`, na raiz do site
publicado. Se o token deixar de funcionar (a renovação falha e o GitHub avisa
por email):

1. No [Graph API Explorer](https://developers.facebook.com/tools/explorer/),
   escolher a app «Art'Visão Site» (2126039054658315) e gerar um token de
   utilizador com `pages_show_list`, `pages_read_engagement`,
   `instagram_basic` e `business_management`.
2. Guardá-lo no secret `FB_USER_TOKEN` e correr a Action **Renovar token da
   Meta**, que o troca por um de 60 dias. Não sair do Facebook antes de ela
   terminar: o token acabado de gerar deixa de valer quando a sessão termina.
3. Correr **Publicar no GitHub Pages**.

## Acrescentar uma marca

1. Guardar o logótipo em `artvisao/assets/brands/` (SVG de preferência;
   PNG até ~480px de largura).
2. Copiar uma das linhas da lista `.brand-grid` em `index.html` e trocar o
   `href`, o `src`, o `alt` e o nome.

/* Pesquisa do site.
   O índice é construído a partir do DOM no momento da pesquisa, por isso
   acompanha automaticamente o idioma ativo — não duplica as traduções.
   Os rótulos gerados por JS (grupos, dicas) vivem num dicionário escondido
   no markup, pelo mesmo motivo. */

(function () {
  var overlay = document.getElementById('searchOverlay');
  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  var closeBtn = document.getElementById('searchClose');
  var triggers = document.querySelectorAll('[data-search-trigger]');

  if (!overlay || !input || !results || !triggers.length) return;

  function normalize(str) {
    return str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
  }

  // textContent alone would glue lines together where the copy uses <br>, so those become spaces
  function text(el) {
    if (!el) return '';
    var clone = el.cloneNode(true);
    clone.querySelectorAll('br').forEach(function (br) { br.replaceWith(' '); });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  // Reads a JS-generated label from the hidden dictionary, so it follows the active language.
  function label(name, fallback) {
    var el = overlay.querySelector('[data-search-label="' + name + '"]');
    return el ? text(el) : fallback;
  }

  function buildIndex() {
    var items = [];

    function add(group, title, snippet, haystackExtra, section, focus, thumb) {
      if (!title) return;
      items.push({
        group: group,
        title: title,
        snippet: snippet || '',
        thumb: thumb || null,
        haystack: normalize([title, snippet, haystackExtra || ''].join(' ')),
        section: section,
        focus: focus || null
      });
    }

    // Serviços
    document.querySelectorAll('#servicos .service-card').forEach(function (card) {
      add('services', text(card.querySelector('.service-title')), text(card.querySelector('.service-copy')),
        '', document.getElementById('servicos'), card);
    });

    // Coleção — as armações têm imagem, por isso entram com miniatura
    document.querySelectorAll('#colecao .product-card').forEach(function (card) {
      var img = card.querySelector('img');
      add('collection', text(card.querySelector('.product-info h3')),
        text(card.querySelector('.card-caption')), text(card.querySelector('.price-badge')),
        document.getElementById('colecao'), card, img ? img.getAttribute('src') : null);
    });

    // Marcas — o nome fica em .brand-tile-text mesmo quando o logo o esconde
    document.querySelectorAll('#marcas .brand-tile').forEach(function (tile) {
      add('brands', text(tile.querySelector('.brand-tile-text')), '',
        tile.getAttribute('data-logo') || '', document.getElementById('marcas'), tile);
    });

    // Acordos
    document.querySelectorAll('#acordos h3').forEach(function (heading) {
      var body = heading.parentElement;
      add('deals', text(heading), text(body.querySelector('p')), '',
        document.getElementById('acordos'), body);
    });

    // Secções — só o texto que ainda não foi indexado acima
    document.querySelectorAll('main section[id]').forEach(function (section) {
      var heading = section.querySelector('h1, h2');
      if (!heading) return;

      var own = Array.prototype.filter.call(
        section.querySelectorAll('.section-copy, .brand-copy, .hero-description, .testimonial-quote, .visit-value, .visit-label'),
        function (el) { return !el.closest('.service-card, .product-card, .brand-tile'); }
      );
      var ownText = own.map(text).join(' ');

      add('sections', text(heading), text(own[0]), ownText, section, null);
    });

    return items;
  }

  /* Destaca o termo pesquisado sem usar innerHTML */
  function highlight(value, term) {
    var fragment = document.createDocumentFragment();
    var needle = normalize(term);
    if (!needle) {
      fragment.appendChild(document.createTextNode(value));
      return fragment;
    }

    var haystack = normalize(value);
    var from = 0;
    var at = haystack.indexOf(needle);

    // normalize() only strips diacritics and collapses runs of whitespace, so offsets
    // line up with the original string as long as it has no double spaces.
    while (at !== -1) {
      fragment.appendChild(document.createTextNode(value.slice(from, at)));
      var mark = document.createElement('mark');
      mark.textContent = value.slice(at, at + needle.length);
      fragment.appendChild(mark);
      from = at + needle.length;
      at = haystack.indexOf(needle, from);
    }
    fragment.appendChild(document.createTextNode(value.slice(from)));
    return fragment;
  }

  function goTo(item) {
    closeSearch();
    if (item.section) item.section.scrollIntoView();
    var flash = item.focus || item.section;
    if (!flash) return;
    flash.classList.remove('menu-fade');
    void flash.offsetWidth;
    flash.classList.add('menu-fade');
    flash.addEventListener('animationend', function onEnd() {
      flash.classList.remove('menu-fade');
      flash.removeEventListener('animationend', onEnd);
    });
  }

  var GROUPS = [
    ['services', 'services', 'Serviços'],
    ['collection', 'collection', 'Coleção'],
    ['brands', 'brands', 'Marcas'],
    ['deals', 'deals', 'Acordos'],
    ['sections', 'sections', 'Secções'],
  ];

  var activeItems = [];

  function hint(message) {
    var p = document.createElement('p');
    p.className = 'search-hint';
    p.textContent = message;
    results.appendChild(p);
  }

  function render(term) {
    results.innerHTML = '';
    activeItems = [];

    var query = normalize(term);
    if (!query) {
      hint(label('hint', 'Pesquise por serviços, marcas, coleção ou secções.'));
      return;
    }

    var matches = buildIndex().filter(function (item) { return item.haystack.indexOf(query) !== -1; });
    if (!matches.length) {
      hint(label('empty', 'Sem resultados para') + ' “' + term.trim() + '”');
      return;
    }

    GROUPS.forEach(function (group) {
      var key = group[0];
      var groupItems = matches.filter(function (item) { return item.group === key; });
      if (!groupItems.length) return;

      var title = document.createElement('p');
      title.className = 'search-group';
      title.textContent = label(group[1], group[2]);
      results.appendChild(title);

      groupItems.forEach(function (item) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'search-result';

        if (item.thumb) {
          var img = document.createElement('img');
          img.className = 'search-thumb';
          img.src = item.thumb;
          img.alt = '';
          row.appendChild(img);
        }

        var body = document.createElement('span');
        body.className = 'search-result-text';

        var rowTitle = document.createElement('span');
        rowTitle.className = 'search-result-title';
        rowTitle.appendChild(highlight(item.title, term));
        body.appendChild(rowTitle);

        if (item.snippet) {
          var snippet = document.createElement('span');
          snippet.className = 'search-result-snippet';
          var short = item.snippet.length > 120 ? item.snippet.slice(0, 120) + '…' : item.snippet;
          snippet.appendChild(highlight(short, term));
          body.appendChild(snippet);
        }

        row.appendChild(body);
        row.addEventListener('click', function () { goTo(item); });
        results.appendChild(row);
        activeItems.push(item);
      });
    });
  }

  var opener = triggers[0];

  function onKeydown(e) {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key !== 'Tab') return;

    var focusables = overlay.querySelectorAll('input, button');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openSearch() {
    overlay.classList.add('is-open');
    document.body.classList.add('search-open');
    opener.setAttribute('aria-expanded', 'true');
    input.value = '';
    render('');
    input.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function closeSearch() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('search-open');
    opener.setAttribute('aria-expanded', 'false');
    opener.focus();
    document.removeEventListener('keydown', onKeydown);
  }

  triggers.forEach(function (el) {
    el.addEventListener('click', function () {
      opener = el;
      openSearch();
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeSearch);

  input.addEventListener('input', function () { render(input.value); });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && activeItems.length) {
      e.preventDefault();
      goTo(activeItems[0]);
    }
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeSearch();
  });
})();

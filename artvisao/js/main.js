(function () {
  if (window.ArtVisaoI18n && typeof window.ArtVisaoI18n.init === 'function') {
    window.ArtVisaoI18n.init();
  }

  // iOS Safari only evaluates :hover/:active on tap when some touch listener exists on the
  // page — otherwise it skips straight from touchstart to click with no active state at all.
  document.addEventListener('touchstart', function () {}, { passive: true });

  function slugify(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  // The mobile nav is a Bootstrap offcanvas; returns it only while it is actually open.
  function openMobileNav() {
    var navMain = document.getElementById('navMain');
    if (!navMain || !navMain.classList.contains('show')) return null;
    if (!window.bootstrap || !window.bootstrap.Offcanvas) return null;
    return { el: navMain, instance: window.bootstrap.Offcanvas.getOrCreateInstance(navMain) };
  }

  function flashTarget(target) {
    // Reset then re-add the class (and force a reflow) so the animation can re-trigger
    target.classList.remove('menu-fade');
    void target.offsetWidth;
    target.classList.add('menu-fade');

    target.addEventListener('animationend', function onEnd() {
      target.classList.remove('menu-fade');
      target.removeEventListener('animationend', onEnd);
    });
  }

  function initMenuFadeOnNavigate() {
    var navLinks = document.querySelectorAll('.nav-link[href^="#"], .nav-drawer-action[href^="#"]');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var hash = link.getAttribute('href');
        var target = hash && hash !== '#' ? document.querySelector(hash) : null;
        var drawer = openMobileNav();

        if (!drawer) {
          if (target) flashTarget(target);
          return;
        }

        // The drawer locks body scroll while it animates out, so jump only once it is gone.
        if (target) {
          e.preventDefault();
          drawer.el.addEventListener('hidden.bs.offcanvas', function onHidden() {
            drawer.el.removeEventListener('hidden.bs.offcanvas', onHidden);
            target.scrollIntoView();
            // Also set the hash so the URL still reflects the section, as it does on desktop
            window.location.hash = hash;
            flashTarget(target);
          });
        }
        drawer.instance.hide();
      });
    });
  }

  // Avisos rotativos do pré-menu. Todos os slides estão no DOM (para o i18n os traduzir
  // como a tudo o resto); só a classe is-current decide qual se vê.
  function initAnnouncements() {
    var track = document.querySelector('.pre-menu-track');
    if (!track) return;

    var items = track.querySelectorAll('.pre-menu-item');
    if (items.length < 2) {
      if (items.length) items[0].classList.add('is-current');
      return;
    }

    var index = 0;
    var timer = null;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(next) {
      index = (next + items.length) % items.length;
      items.forEach(function (el, i) { el.classList.toggle('is-current', i === index); });
    }

    function start() {
      if (reduced || timer) return;
      timer = setInterval(function () { show(index + 1); }, 6000);
    }

    function stop() {
      clearInterval(timer);
      timer = null;
    }

    var announce = track.closest('.pre-menu-announce');
    announce.querySelector('[data-announce-prev]').addEventListener('click', function () { show(index - 1); stop(); start(); });
    announce.querySelector('[data-announce-next]').addEventListener('click', function () { show(index + 1); stop(); start(); });

    // Não roda por baixo do cursor nem enquanto o teclado lá está
    announce.addEventListener('mouseenter', stop);
    announce.addEventListener('mouseleave', start);
    announce.addEventListener('focusin', stop);
    announce.addEventListener('focusout', start);

    show(0);
    start();
  }

  function showInitialsFallback(tile, name) {
    var words = name.split(/\s+/).filter(Boolean).slice(0, 2);
    var initials = words.map(function (w) { return w[0]; }).join('').toUpperCase() || name.charAt(0).toUpperCase();

    var xmlns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(xmlns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('role', 'img');

    var rect = document.createElementNS(xmlns, 'rect');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '100');
    rect.setAttribute('rx', '14');
    rect.setAttribute('fill', '#3f6f9e');

    var text = document.createElementNS(xmlns, 'text');
    text.setAttribute('x', '50');
    text.setAttribute('y', '59');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-family', 'Fraunces, Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue"');
    text.setAttribute('font-size', '52');
    text.setAttribute('font-weight', '700');
    text.textContent = initials;

    svg.appendChild(rect);
    svg.appendChild(text);

    var svgWrap = document.createElement('span');
    svgWrap.className = 'brand-tile-svg';
    svgWrap.appendChild(svg);

    tile.insertBefore(svgWrap, tile.firstChild);
    tile.classList.add('has-fallback');
  }

  function loadBrandLogo(tile) {
    var name = tile.textContent.trim();
    if (!name) return;

    // Manual data-logo mapping takes priority; otherwise derive a slug from the visible name
    var dataSlug = tile.getAttribute('data-logo');
    var slug = (dataSlug && dataSlug.trim()) || slugify(name);

    // Preferred order: freshly fetched logos, then the project's curated ones
    var candidates = [
      'assets/brands/fetched/' + slug + '.svg',
      'assets/brands/fetched/' + slug + '.png',
      'assets/brands/fetched/' + slug + '.jpg',
      'assets/brands/' + slug + '.svg',
      'assets/brands/' + slug + '.png',
    ];

    var img = document.createElement('img');
    img.className = 'brand-tile-logo';
    img.alt = name + ' logo';

    var idx = 0;
    function tryNextCandidate() {
      if (idx >= candidates.length) {
        showInitialsFallback(tile, name);
        return;
      }
      img.src = candidates[idx++];
    }

    img.onload = function () {
      tile.insertBefore(img, tile.firstChild);
      tile.classList.add('has-logo');
    };
    img.onerror = tryNextCandidate;
    tryNextCandidate();
  }


  // Destaque dos artigos: a fita de imagens desliza e o painel de texto faz cross-fade
  // no lugar — dois movimentos separados, para a mudança não acontecer toda de uma vez.
  // A fita tem um clone da primeira imagem no fim, para a espreitadela nunca ficar vazia.
  function initHighlight() {
    var root = document.querySelector('[data-highlight]');
    if (!root) return;

    var track = root.querySelector('.highlight-track');
    var items = track.querySelectorAll('.highlight-item');
    var copies = root.querySelectorAll('.highlight-copy');
    var dots = root.querySelectorAll('[data-highlight-go]');
    var total = copies.length;
    if (!total || !items.length) return;

    var index = 0;
    var timer = null;

    function render() {
      var step = items[0].getBoundingClientRect().width;
      track.style.transform = 'translateX(' + (-index * step) + 'px)';

      copies.forEach(function (el, i) { el.classList.toggle('is-current', i === index); });
      dots.forEach(function (el, i) {
        el.classList.toggle('active', i === index);
        if (i === index) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      });
    }

    function go(i) {
      index = (i % total + total) % total;
      render();
    }

    // Quem pediu menos movimento no sistema não leva o carrossel a andar sozinho;
    // as setas e os pontos continuam a funcionar.
    var menosMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function start() {
      stop();
      if (menosMovimento) return;
      timer = setInterval(function () { go(index + 1); }, 6000);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    root.querySelector('[data-highlight-prev]').addEventListener('click', function () { go(index - 1); start(); });
    root.querySelector('[data-highlight-next]').addEventListener('click', function () { go(index + 1); start(); });
    dots.forEach(function (el, i) {
      el.addEventListener('click', function () { go(i); start(); });
    });

    // Parar enquanto o visitante lá está, para não lhe fugir o que está a ler
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);

    // A largura do passo vem do layout, por isso reposiciona-se ao redimensionar
    var resizing;
    window.addEventListener('resize', function () {
      clearTimeout(resizing);
      resizing = setTimeout(render, 150);
    });

    render();
    start();
  }


  // As duas lojas num só mapa. O embed do Google só marca um lugar por iframe, por isso
  // este é desenhado com Leaflet sobre tiles do OpenStreetMap — não precisa de chave de API.
  // A biblioteca só é descarregada depois do consentimento, para nada ser pedido antes disso.
  var LOJAS = [
    { nome: 'Art\'Visão · Castelo Branco', lat: 39.8164797, lng: -7.4843152 },
    { nome: 'Art\'Visão · Soito', lat: 40.3587299, lng: -6.9686759 }
  ];

  function carregarLeaflet(pronto) {
    if (window.L) { pronto(); return; }

    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    var js = document.createElement('script');
    js.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    js.onload = pronto;
    document.head.appendChild(js);
  }

  function desenharMapaLojas(el) {
    carregarLeaflet(function () {
      if (!window.L || el.getAttribute('data-map-desenhado') !== null) return;
      el.setAttribute('data-map-desenhado', '');

      // scrollWheelZoom desligado para a roda do rato continuar a percorrer a página
      var mapa = L.map(el, { scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(mapa);

      // Balão próprio em SVG: o do Leaflet vem de ficheiros PNG na CDN e fica na cor dele
      var balao = L.divIcon({
        className: 'mapa-pin',
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 32" aria-hidden="true">'
          + '<path d="M12 0C5.9 0 1 4.9 1 11c0 8 11 21 11 21s11-13 11-21c0-6.1-4.9-11-11-11z" '
          + 'fill="#5b8fc7" stroke="#faf6ef" stroke-width="1.5"/>'
          + '<circle cx="12" cy="11" r="4" fill="#faf6ef"/></svg>',
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -36]
      });

      var balões = LOJAS.map(function (loja) {
        return L.marker([loja.lat, loja.lng], { icon: balao, title: loja.nome }).bindPopup(loja.nome);
      });
      var grupo = L.featureGroup(balões).addTo(mapa);
      mapa.fitBounds(grupo.getBounds(), { padding: [28, 28] });
    });
  }

  window.addEventListener('artvisao:mapa-autorizado', function (e) { desenharMapaLojas(e.detail); });

  document.addEventListener('DOMContentLoaded', function () {
    initMenuFadeOnNavigate();
    initAnnouncements();
    initHighlight();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var galeria = document.getElementById('lojaCarousel');
      if (galeria) galeria.removeAttribute('data-bs-ride');
    }
    document.querySelectorAll('.brand-tile').forEach(loadBrandLogo);
  });
})();

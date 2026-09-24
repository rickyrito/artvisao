(function () {
  if (window.ArtVisaoI18n && typeof window.ArtVisaoI18n.init === 'function') {
    window.ArtVisaoI18n.init();
  }

  // iOS Safari only evaluates :hover/:active on tap when some touch listener exists on the
  // page — otherwise it skips straight from touchstart to click with no active state at all.
  document.addEventListener('touchstart', function () {}, { passive: true });

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

    // A rotação automática não é anunciada (o leitor de ecrã repetia um aviso a cada 6s);
    // só a troca pedida pelo visitante nas setas.
    track.setAttribute('aria-live', 'off');
    function byUser(step) {
      track.setAttribute('aria-live', 'polite');
      show(index + step); stop(); start();
    }

    var announce = track.closest('.pre-menu-announce');
    announce.querySelector('[data-announce-prev]').addEventListener('click', function () { byUser(-1); });
    announce.querySelector('[data-announce-next]').addEventListener('click', function () { byUser(1); });

    // Não roda por baixo do cursor nem enquanto o teclado lá está
    announce.addEventListener('mouseenter', stop);
    announce.addEventListener('mouseleave', start);
    announce.addEventListener('focusin', stop);
    announce.addEventListener('focusout', start);

    show(0);
    start();
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

    // Só se anuncia o texto novo quando foi o visitante a mudar de artigo;
    // a passagem automática fica calada para não interromper a leitura.
    var live = root.querySelector('.highlight-text');
    function anunciar(sim) { if (live) live.setAttribute('aria-live', sim ? 'polite' : 'off'); }
    anunciar(false);

    function start() {
      stop();
      if (menosMovimento) return;
      timer = setInterval(function () { anunciar(false); go(index + 1); }, 6000);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function byUser(i) { anunciar(true); go(i); start(); }

    root.querySelector('[data-highlight-prev]').addEventListener('click', function () { byUser(index - 1); });
    root.querySelector('[data-highlight-next]').addEventListener('click', function () { byUser(index + 1); });
    dots.forEach(function (el, i) {
      el.addEventListener('click', function () { byUser(i); });
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

    // Com integrity, o browser recusa os ficheiros se a CDN alguma vez os servir alterados
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H';
    css.crossOrigin = 'anonymous';
    document.head.appendChild(css);

    var js = document.createElement('script');
    js.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    js.integrity = 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH';
    js.crossOrigin = 'anonymous';
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
    var galeria = document.getElementById('lojaCarousel');
    if (galeria && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      galeria.removeAttribute('data-bs-ride');
    }
    // O Bootstrap só pára o carrossel com o rato por cima; aqui pára também enquanto
    // o foco do teclado está nas setas ou nos pontos, para quem navega sem rato.
    if (galeria && window.bootstrap && window.bootstrap.Carousel) {
      galeria.addEventListener('focusin', function () {
        window.bootstrap.Carousel.getOrCreateInstance(galeria).pause();
      });
      galeria.addEventListener('focusout', function (e) {
        if (galeria.contains(e.relatedTarget) || !galeria.hasAttribute('data-bs-ride')) return;
        window.bootstrap.Carousel.getOrCreateInstance(galeria).cycle();
      });
    }
  });
})();

(function () {
  if (window.ArtVisaoI18n && typeof window.ArtVisaoI18n.init === 'function') {
    window.ArtVisaoI18n.init();
  }

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

  document.addEventListener('DOMContentLoaded', function () {
    initMenuFadeOnNavigate();
    initAnnouncements();
    document.querySelectorAll('.brand-tile').forEach(loadBrandLogo);
  });
})();

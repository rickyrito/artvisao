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

  function collapseMobileNav() {
    var navMain = document.getElementById('navMain');
    if (!navMain || !navMain.classList.contains('show')) return;
    if (!window.bootstrap || !window.bootstrap.Collapse) return;
    window.bootstrap.Collapse.getOrCreateInstance(navMain).hide();
  }

  function initMenuFadeOnNavigate() {
    var navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        collapseMobileNav();

        var hash = link.getAttribute('href');
        if (!hash || hash === '#') return;
        var target = document.querySelector(hash);
        if (!target) return;

        // Reset then re-add the class (and force a reflow) so the animation can re-trigger
        target.classList.remove('menu-fade');
        void target.offsetWidth;
        target.classList.add('menu-fade');

        target.addEventListener('animationend', function onEnd() {
          target.classList.remove('menu-fade');
          target.removeEventListener('animationend', onEnd);
        });
      });
    });
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
    document.querySelectorAll('.brand-tile').forEach(loadBrandLogo);
  });
})();

/* Consentimento de cookies.
   O banner só é honesto se bloquear de facto: os mapas do Google só recebem o src
   depois de o visitante consentir, e a escolha fica guardada localmente.
   Categorias correspondem ao que o site carrega mesmo — não há analytics nem marketing. */

(function () {
  var KEY = 'artvisao-consent';
  var banner = document.getElementById('consentBanner');
  var panel = document.getElementById('consentPanel');
  if (!banner || !panel) return;

  var mapsToggle = document.getElementById('consentMaps');
  var openers = document.querySelectorAll('[data-consent-open]');
  var lastFocus = null;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  function write(choice) {
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch (e) { /* modo privado */ }
  }

  // Só põe o src quando há consentimento; sem ele o iframe nunca chega a contactar o Google.
  function applyMaps(allowed) {
    document.querySelectorAll('[data-consent-src]').forEach(function (frame) {
      var slot = frame.closest('.map-slot');
      var blocked = slot && slot.querySelector('.map-blocked');
      if (allowed) {
        if (!frame.getAttribute('src')) frame.setAttribute('src', frame.getAttribute('data-consent-src'));
        frame.hidden = false;
        if (blocked) blocked.hidden = true;
      } else {
        frame.removeAttribute('src');
        frame.hidden = true;
        if (blocked) blocked.hidden = false;
      }
    });

    // Mapa desenhado por nós (Leaflet + OpenStreetMap): os tiles também são um pedido a
    // terceiros, por isso nada é carregado antes do consentimento. Quem o desenha é o main.js.
    document.querySelectorAll('[data-consent-map]').forEach(function (el) {
      var slot = el.closest('.map-slot');
      var blocked = slot && slot.querySelector('.map-blocked');
      if (allowed) {
        el.hidden = false;
        if (blocked) blocked.hidden = true;
        if (!el.hasAttribute('data-map-ready')) {
          el.setAttribute('data-map-ready', '');
          window.dispatchEvent(new CustomEvent('artvisao:mapa-autorizado', { detail: el }));
        }
      } else {
        el.hidden = true;
        if (blocked) blocked.hidden = false;
      }
    });
  }

  function apply(choice) {
    applyMaps(!!(choice && choice.maps));
  }

  function save(choice) {
    choice.ts = new Date().toISOString();
    write(choice);
    apply(choice);
    hideBanner();
    closePanel();
  }

  function showBanner() {
    banner.hidden = false;
    document.body.classList.add('consent-banner-open');
  }

  function hideBanner() {
    banner.hidden = true;
    document.body.classList.remove('consent-banner-open');
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { closePanel(); return; }
    if (e.key !== 'Tab') return;
    var focusables = panel.querySelectorAll('button, input:not([disabled]), a[href]');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openPanel() {
    lastFocus = document.activeElement;
    var current = read();
    mapsToggle.checked = !!(current && current.maps);
    panel.hidden = false;
    document.body.classList.add('consent-panel-open');
    mapsToggle.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function closePanel() {
    if (panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove('consent-panel-open');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocus && lastFocus.offsetParent) lastFocus.focus();
  }

  banner.querySelector('[data-consent-accept]').addEventListener('click', function () { save({ maps: true }); });
  banner.querySelector('[data-consent-reject]').addEventListener('click', function () { save({ maps: false }); });
  banner.querySelector('[data-consent-prefs]').addEventListener('click', openPanel);

  panel.querySelector('[data-consent-accept]').addEventListener('click', function () { save({ maps: true }); });
  panel.querySelector('[data-consent-reject]').addEventListener('click', function () { save({ maps: false }); });
  panel.querySelector('[data-consent-save]').addEventListener('click', function () { save({ maps: mapsToggle.checked }); });
  panel.querySelectorAll('[data-consent-dismiss]').forEach(function (el) {
    el.addEventListener('click', closePanel);
  });

  openers.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openPanel();
    });
  });

  // Pedido explícito e específico para aquele mapa — vale como consentimento dessa categoria.
  document.querySelectorAll('[data-consent-enable-maps]').forEach(function (btn) {
    btn.addEventListener('click', function () { save({ maps: true }); });
  });

  var saved = read();
  apply(saved);
  if (!saved) showBanner();
})();

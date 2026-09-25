/* Consentimento de cookies.
   O banner só é honesto se bloquear de facto: os mapas do Google só recebem o src e o
   Google Analytics só é descarregado depois de o visitante consentir; a escolha fica
   guardada localmente. Categorias: necessárias, mapas e estatísticas — não há marketing. */

(function () {
  var KEY = 'artvisao-consent';
  var banner = document.getElementById('consentBanner');
  var panel = document.getElementById('consentPanel');
  if (!banner || !panel) return;

  var mapsToggle = document.getElementById('consentMaps');
  var statsToggle = document.getElementById('consentStats');

  // Google Analytics (GA4). Só no domínio de produção: as visitas à cópia de teste e às
  // cópias locais não entram nas estatísticas.
  var GA_ID = 'G-J551NMQL4J';
  var GA_HOSTS = ['www.artvisao.pt', 'artvisao.pt'];
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

  // O gtag.js só é pedido à Google depois do consentimento: antes disso não há script,
  // cookies nem pedidos. Sem consentimento para publicidade, os sinais de anúncios ficam negados.
  function loadAnalytics() {
    if (GA_HOSTS.indexOf(location.hostname) === -1) return;
    window['ga-disable-' + GA_ID] = false;
    if (window.gtag) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  // Retirar o consentimento: pára o envio já nesta página e apaga os cookies _ga*.
  function disableAnalytics() {
    window['ga-disable-' + GA_ID] = true;
    if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    var host = location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name.indexOf('_ga') !== 0) return;
      ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
  }

  function apply(choice) {
    applyMaps(!!(choice && choice.maps));
    if (choice && choice.stats) loadAnalytics(); else disableAnalytics();
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
    if (statsToggle) statsToggle.checked = !!(current && current.stats);
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

  function acceptAll() { save({ maps: true, stats: true }); }
  function rejectAll() { save({ maps: false, stats: false }); }

  banner.querySelector('[data-consent-accept]').addEventListener('click', acceptAll);
  banner.querySelector('[data-consent-reject]').addEventListener('click', rejectAll);
  banner.querySelector('[data-consent-prefs]').addEventListener('click', openPanel);

  panel.querySelector('[data-consent-accept]').addEventListener('click', acceptAll);
  panel.querySelector('[data-consent-reject]').addEventListener('click', rejectAll);
  panel.querySelector('[data-consent-save]').addEventListener('click', function () {
    save({ maps: mapsToggle.checked, stats: !!(statsToggle && statsToggle.checked) });
  });
  panel.querySelectorAll('[data-consent-dismiss]').forEach(function (el) {
    el.addEventListener('click', closePanel);
  });

  openers.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openPanel();
    });
  });

  // Pedido explícito e específico para aquele mapa — vale como consentimento dessa categoria
  // e só dessa: a escolha que já existia para as estatísticas mantém-se.
  document.querySelectorAll('[data-consent-enable-maps]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var current = read();
      save({ maps: true, stats: !!(current && current.stats) });
    });
  });

  var saved = read();
  apply(saved);
  // Quem respondeu antes de haver estatísticas ainda não se pronunciou sobre elas:
  // o banner volta a aparecer uma vez, e a escolha dos mapas continua aplicada até lá.
  if (!saved || !('stats' in saved)) showBanner();
})();

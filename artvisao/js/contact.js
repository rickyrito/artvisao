/* Formulário de contacto.
   Envia por fetch para ter resposta sem sair da página; sem JS o form faz POST
   normal para o mesmo endpoint, que devolve uma página de confirmação. */

(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;

  var status = document.getElementById('contactStatus');
  var button = form.querySelector('.contact-submit');

  // Lê o texto do dicionário escondido, para acompanhar o idioma ativo.
  function msg(key) {
    var el = form.querySelector('[data-cf-msg="' + key + '"]');
    return el ? el.textContent.trim() : '';
  }

  function show(key, ok) {
    status.textContent = msg(key);
    status.classList.toggle('is-error', ok === false);
    status.classList.toggle('is-ok', ok === true);
    status.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var nome = form.name.value.trim();
    var email = form.email.value.trim();
    var texto = form.message.value.trim();

    if (!nome || !email || !texto) { show('incomplete', false); return; }
    if (!form.email.checkValidity()) { show('bademail', false); return; }

    button.disabled = true;
    show('sending');

    fetch(form.action, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok, key: r.ok ? 'sent' : 'failed' }; }); })
      .then(function (data) {
        show(data.key || (data.ok ? 'sent' : 'failed'), !!data.ok);
        if (data.ok) form.reset();
      })
      .catch(function () { show('failed', false); })
      .then(function () { button.disabled = false; });
  });
})();

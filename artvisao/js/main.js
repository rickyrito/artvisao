(function(){
  if (window.ArtVisaoI18n && typeof window.ArtVisaoI18n.init === 'function') {
    window.ArtVisaoI18n.init();
  }

  document.addEventListener('DOMContentLoaded', function(){
    var navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    navLinks.forEach(function(link){
      link.addEventListener('click', function(){
        var hash = link.getAttribute('href');
        if (!hash || hash === '#') return;
        var target = document.querySelector(hash);
        if (!target) return;
        // Reset class to allow re-triggering the animation
        target.classList.remove('menu-fade');
        // Force reflow
        void target.offsetWidth;
        target.classList.add('menu-fade');
        // Clean up after animation
        var onEnd = function(){
          target.classList.remove('menu-fade');
          target.removeEventListener('animationend', onEnd);
        };
        target.addEventListener('animationend', onEnd);
      });
    });

    // Try to load brand logos from assets/brands/<slug>.svg or .png
    var brandPills = document.querySelectorAll('.brand-pill');
    brandPills.forEach(function(pill){
      var name = pill.textContent.trim();
      if (!name) return;
      // If a data-logo is provided, prefer it (manual mapping); otherwise create a slug from the visible name
      var dataSlug = pill.getAttribute('data-logo');
      var slug = dataSlug && dataSlug.trim() ? dataSlug.trim() : name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');
      var svgPath = 'assets/brands/' + slug + '.svg';
      var pngPath = 'assets/brands/' + slug + '.png';

      var img = document.createElement('img');
      img.className = 'brand-pill-logo';
      img.alt = name + ' logo';

      // Candidate paths in preferred order: fetched svg/png/jpg, project svg/png, then fallback
      var candidates = [
        'assets/brands/fetched/' + slug + '.svg',
        'assets/brands/fetched/' + slug + '.png',
        'assets/brands/fetched/' + slug + '.jpg',
        svgPath,
        pngPath,
      ];

      var idx = 0;
      var applied = false;

      function tryNext(){
        if (idx >= candidates.length){
          // exhausted — create inline SVG initials fallback
          try { if (img.parentNode) img.parentNode.removeChild(img); } catch(e){}
          var words = name.split(/\s+/).filter(Boolean).slice(0,2);
          var initials = words.map(function(w){return w[0];}).join('').toUpperCase();
          if (!initials) initials = name.charAt(0).toUpperCase();
          var svgWrap = document.createElement('span');
          svgWrap.className = 'brand-pill-svg';
          var xmlns = 'http://www.w3.org/2000/svg';
          var svg = document.createElementNS(xmlns, 'svg');
          svg.setAttribute('viewBox','0 0 100 100');
          svg.setAttribute('role','img');
          var rect = document.createElementNS(xmlns, 'rect');
          rect.setAttribute('x','0'); rect.setAttribute('y','0'); rect.setAttribute('width','100'); rect.setAttribute('height','100'); rect.setAttribute('rx','14');
          rect.setAttribute('fill','#3f6f9e');
          var text = document.createElementNS(xmlns, 'text');
          text.setAttribute('x','50'); text.setAttribute('y','59'); text.setAttribute('text-anchor','middle');
          text.setAttribute('fill','#fff'); text.setAttribute('font-family','Fraunces, Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue"');
          text.setAttribute('font-size','52'); text.setAttribute('font-weight','700');
          text.textContent = initials;
          svg.appendChild(rect); svg.appendChild(text); svgWrap.appendChild(svg);
          pill.insertBefore(svgWrap, pill.firstChild);
          pill.classList.add('has-fallback');
          return;
        }

        var src = candidates[idx++];

        // First try a fetch to check availability (more reliable than solely relying on image load events)
        fetch(src).then(function(resp){
          if (resp.ok){
            img.src = src;
          } else {
            tryNext();
          }
        }).catch(function(){
          tryNext();
        });
      }

      img.onload = function(){
        if (!applied){
          pill.insertBefore(img, pill.firstChild);
          pill.classList.add('has-logo');
          applied = true;
        }
      };
      img.onerror = function(){
        tryNext();
      };

      // Start trying candidates
      tryNext();
    });
  });

})();

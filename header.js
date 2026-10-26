'use strict';

// Supplement each page's existing menu toggle with consistent dismissal.
(() => {
  const header = document.querySelector('.hamie-header');
  const nav = header.querySelector('.site-nav');
  const toggle = header.querySelector('button');
  function closeMenu() {
    nav.classList.remove('open', 'is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Mở menu');
  }
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('pointerdown', event => {
    if (!header.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 1001px)').addEventListener('change', closeMenu);
})();

(function () {
  /* ---------- Phone menu: [data-nav-toggle] opens the primary nav at 900px and below ---------- */
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('[data-nav-toggle]');
  if (!header || !toggle) return;
  var nav = document.getElementById(toggle.getAttribute('aria-controls'));
  var wide = window.matchMedia('(min-width: 901px)');

  function setOpen(open) {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  toggle.addEventListener('click', function () { setOpen(!header.classList.contains('is-open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });
  wide.addEventListener && wide.addEventListener('change', function (e) { if (e.matches) setOpen(false); });
})();

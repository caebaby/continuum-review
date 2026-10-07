/* Review build only: a dismissible "Review draft" note, fixed bottom-left on every page.
   Dismissal is remembered in localStorage. Hidden on ?state=final captures. */
(function () {
  var KEY = 'cpp-review-pill-dismissed';
  if (/[?&]state=final/.test(location.search)) return;
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}

  var pill = document.createElement('aside');
  pill.className = 'review-pill';
  pill.setAttribute('aria-label', 'Review draft');
  pill.innerHTML =
    '<p><strong>Review draft.</strong> Photos are placeholders; items marked <span class="review-pill-tag">[CONFIRM]</span> need your input.</p>' +
    '<button type="button" class="review-pill-close" aria-label="Dismiss review note"><span aria-hidden="true">×</span></button>';
  pill.querySelector('button').addEventListener('click', function () {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    pill.remove();
  });
  document.body.appendChild(pill);
})();

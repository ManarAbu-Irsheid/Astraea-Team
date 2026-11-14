/* Home page ⋮ quick menu, same items and look as the inner pages: tour, contact, AI assistant, account. */
(function () {
  'use strict';
  const btn = document.getElementById('homeMenuBtn'), pop = document.getElementById('homeMenu');
  if (!btn || !pop) return;
  const items = () => Array.from(pop.querySelectorAll('a, button'));
  const open = () => { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); items()[0]?.focus(); };
  const close = (focus) => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden ? open() : close(); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) close(); });
  pop.addEventListener('keydown', (e) => {
    const all = items(), i = all.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (all[i + 1] || all[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (all[i - 1] || all[all.length - 1]).focus(); }
  });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    close();
    if (b.dataset.act === 'tour') document.getElementById('tourBtn')?.click();
    if (b.dataset.act === 'contact' && window.UserSystem) window.UserSystem.openContactModal();
    if (b.dataset.act === 'chat') document.getElementById('chatbotTriggerBtn')?.click();
    if (b.dataset.act === 'signout' && window.UserSystem) Promise.resolve(window.UserSystem.signOut()).then(syncAuth);
  });

  // Signed-in visitors see their profile picture instead of Sign In / Sign Up (reads UserSystem only, no backend changes)
  function syncAuth() {
    const us = window.UserSystem, u = us && us.currentUser, inn = !!(u && u.isLoggedIn);
    const $ = (id) => document.getElementById(id);
    ['homeSignIn', 'homeSignUp', 'homeMenuAuth'].forEach((id) => { const el = $(id); if (el) el.hidden = inn; });
    ['homeMenuOut', 'homeMenuProfile'].forEach((id) => { const el = $(id); if (el) el.hidden = !inn; });
    const av = $('homeAvatar'); if (!av) return;
    av.hidden = !inn;
    if (inn) {
      av.innerHTML = window.AstraeaAvatars ? window.AstraeaAvatars.renderSvg(u.avatar, 34, u.gender) : '<span>' + ((u.name || '?').trim()[0] || '?').toUpperCase() + '</span>';
      if (u.name) av.title = u.name;
    }
  }
  syncAuth();
  document.addEventListener('DOMContentLoaded', syncAuth);
  window.addEventListener('astraea:signedOut', syncAuth);
})();

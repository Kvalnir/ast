/* Service worker registration, update prompt, and install button.
 *
 * Everything here is optional decoration: with JS off, an old browser, or a
 * failed registration, both pages work exactly as they did before.
 *
 * Note that a service worker only registers over https or on localhost, so
 * opening the files with file:// gives you the plain site with no offline
 * support. Use `python3 -m http.server` to exercise it locally.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  // localStorage throws outright in some privacy modes, and a dead install
  // banner is not worth taking the page down for.
  function remembered(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* no memory available; the prompt just repeats */ }
    return null;
  }

  // ---- a single small bar, bottom centre, reused by both prompts ----------
  // Only ever one: the install offer and the update notice sit at the same
  // point on screen, and shown together they overlap into an unreadable pile.
  function bar(text, actionLabel, onAction, onDismiss) {
    var old = document.querySelector('.pwabar');
    if (old) old.remove();

    var el = document.createElement('div');
    el.className = 'pwabar';
    el.setAttribute('role', 'status');

    var span = document.createElement('span');
    span.textContent = text;

    var act = document.createElement('button');
    act.className = 'tbtn';
    act.textContent = actionLabel;
    act.addEventListener('click', function () { el.remove(); onAction(); });

    var dismiss = document.createElement('button');
    dismiss.className = 'pwabar-x';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', function () {
      el.remove();
      if (onDismiss) onDismiss();
    });

    el.append(span, act, dismiss);
    document.body.appendChild(el);
    return el;
  }

  // ---- update flow -------------------------------------------------------
  // The new worker parks in `waiting` until the visitor says go, so a puzzle
  // in progress is never reloaded out from under them.
  //
  // The reload is gated on THIS page having asked for the update, which is
  // narrower than it looks. `controllerchange` also fires:
  //   * on the very first visit, when the worker calls clients.claim() and the
  //     controller goes from null to active — an ungated handler reloads the
  //     page a second after it opened, which on the trainer means a different
  //     random puzzle and any digits already entered thrown away (the board
  //     keeps no persisted state);
  //   * in every other open tab when one of them accepts an update, which
  //     would wipe their boards too.
  // Those tabs pick the new code up on their next navigation instead.
  var accepted = false, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!accepted || reloading) return;
    reloading = true;
    window.location.reload();
  });

  var updateShown = false;
  function offerUpdate(worker) {
    updateShown = true;
    bar('A new version of the site is ready.', 'Reload', function () {
      accepted = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', function () {
      // A controller already present means this is an update rather than the
      // very first install, which needs no announcement.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        offerUpdate(worker);
      }
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      // An update that started downloading before this script ran has already
      // fired its `updatefound`, so the listener below would never see it.
      watch(reg.installing);
      reg.addEventListener('updatefound', function () { watch(reg.installing); });
    }).catch(function () { /* offline support is a bonus, not a dependency */ });
  });

  // ---- install button ----------------------------------------------------
  // Chromium fires this instead of showing its own prompt once the site is
  // installable. Safari and Firefox never fire it and use their own menus.
  // It fires on every load until the site is installed, so a dismissal is
  // remembered — being asked again on each visit is what makes these hateful.
  // Prefixed for the same reason the caches are: localStorage belongs to the
  // whole github.io account, not to this project's path.
  var DISMISSED = 'ast:pwa-install-dismissed';
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    // An update notice already on screen outranks this one: it is the older
    // page telling the visitor its code is stale.
    if (updateShown || remembered(DISMISSED) === '1') return;
    var deferred = e;
    bar('Install this as an app for offline practice.', 'Install', function () {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; });
    }, function () {
      remembered(DISMISSED, '1');
    });
  });
}());

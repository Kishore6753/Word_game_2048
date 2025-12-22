 /*
  INTENTIONAL BREAK: This guard stops the app from initializing and shows a visible error banner.
  To REVERT: set INTENTIONAL_BREAK to false, or remove this block and restore the original init.
*/

const INTENTIONAL_BREAK = true;

function showIntentionalErrorBanner() {
  try {
    // Fixed top banner for immediate visibility
    var banner = document.createElement('div');
    banner.id = 'intentional-error-banner';
    banner.textContent = 'Intentional Error: The app is temporarily disabled for testing.';
    banner.setAttribute(
      'style',
      [
        'position:fixed',
        'top:0',
        'left:0',
        'right:0',
        'z-index:99999',
        'background:#c0392b',
        'color:#fff',
        'font-family: Arial, Helvetica, sans-serif',
        'font-size:16px',
        'padding:14px 16px',
        'text-align:center',
        'box-shadow:0 2px 8px rgba(0,0,0,0.25)'
      ].join(';')
    );
    document.body.appendChild(banner);

    // Centered overlay card for additional emphasis in previews
    var overlay = document.createElement('div');
    overlay.id = 'intentional-error-overlay';
    overlay.setAttribute(
      'style',
      [
        'position:fixed',
        'inset:0',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(0,0,0,0.35)',
        'z-index:99998'
      ].join(';')
    );
    var card = document.createElement('div');
    card.setAttribute(
      'style',
      [
        'background:#fff',
        'color:#c0392b',
        'border:2px solid #c0392b',
        'border-radius:8px',
        'padding:20px 24px',
        'max-width:520px',
        'width:90%',
        'text-align:center',
        'font-family: Arial, Helvetica, sans-serif',
        'box-shadow:0 6px 24px rgba(0,0,0,0.25)'
      ].join(';')
    );
    var title = document.createElement('div');
    title.textContent = 'Intentional Error';
    title.setAttribute('style', 'font-size:20px;font-weight:bold;margin-bottom:8px;');
    var msg = document.createElement('div');
    msg.textContent = 'The app is temporarily disabled for testing.';
    msg.setAttribute('style', 'font-size:16px;');

    card.appendChild(title);
    card.appendChild(msg);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  } catch (e) {
    // If any styling fails, error throw below will still halt app
  }
}

document.addEventListener('DOMContentLoaded', function () {
  if (INTENTIONAL_BREAK) {
    showIntentionalErrorBanner();
    // Throw to halt any further game initialization
    throw new Error('Intentional Error: The app is temporarily disabled for testing.');
  }

  // Normal initialization (only runs when INTENTIONAL_BREAK is false)
  // Wait till the browser is ready to render the game (avoids glitches)
  window.requestAnimationFrame(function () {
    new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
  });
});

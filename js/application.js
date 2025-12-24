/*
  Usage notes (modes update):
  - The app now supports:
      * Board size selection: 4x4 (default) or 5x5
      * Hard mode toggle (persisted)
      * Time-attack toggle (persisted): 2-minute countdown; best score tracked separately
  - Game saves and best scores are namespaced by (size, hard, time-attack) to avoid corruption between modes.
*/

(function () {
  function $(sel) { return document.querySelector(sel); }

  function buildStoragePrefix(opts) {
    // v2 prefix to avoid colliding with legacy keys
    return "2048:v2"
      + ":s" + opts.size
      + ":ta" + (opts.timeAttack ? "1" : "0")
      + ":h" + (opts.hard ? "1" : "0");
  }

  function readSettings() {
    // Use a temporary manager just for reading global settings keys.
    var temp = new LocalStorageManager("2048:v2:temp");
    return {
      size: temp.getBoardSize(),
      hard: temp.getHardModeEnabled(),
      timeAttack: temp.getTimeAttackEnabled()
    };
  }

  function persistSettings(settings) {
    var temp = new LocalStorageManager("2048:v2:temp");
    temp.setBoardSize(settings.size);
    temp.setHardModeEnabled(settings.hard);
    temp.setTimeAttackEnabled(settings.timeAttack);
  }

  function initUI(settings, onChange) {
    var boardSelect = $(".board-size-select");
    var hardToggle = $(".hard-mode-toggle");
    var timeToggle = $(".time-attack-toggle");

    if (boardSelect) boardSelect.value = String(settings.size);
    if (hardToggle) hardToggle.checked = !!settings.hard;
    if (timeToggle) timeToggle.checked = !!settings.timeAttack;

    function notify() {
      var next = {
        size: boardSelect ? parseInt(boardSelect.value, 10) : settings.size,
        hard: hardToggle ? !!hardToggle.checked : settings.hard,
        timeAttack: timeToggle ? !!timeToggle.checked : settings.timeAttack
      };
      // Validate size
      next.size = (next.size === 5 || next.size === 4) ? next.size : 4;

      persistSettings(next);
      onChange(next);
    }

    if (boardSelect) boardSelect.addEventListener("change", notify);
    if (hardToggle) hardToggle.addEventListener("change", notify);
    if (timeToggle) timeToggle.addEventListener("change", notify);
  }

  // Wait till the browser is ready to render the game (avoids glitches)
  window.requestAnimationFrame(function () {
    var settings = readSettings();
    var game = null;

    function startNewGame(nextSettings) {
      settings = nextSettings;

      // New namespace per mode/size
      var prefix = buildStoragePrefix(settings);

      // Starting a different namespace is effectively a different save-slot;
      // we do not migrate state across modes.
      game = new GameManager(
        settings.size,
        KeyboardInputManager,
        HTMLActuator,
        LocalStorageManager,
        {
          storageKeyPrefix: prefix,
          hardMode: settings.hard,
          timeAttack: settings.timeAttack,
          timeLimitMs: 2 * 60 * 1000
        }
      );
    }

    initUI(settings, function (next) {
      // Recreate game manager using new mode settings.
      // This ensures grid size + timer are correctly initialized.
      startNewGame(next);
    });

    startNewGame(settings);
  });
})();

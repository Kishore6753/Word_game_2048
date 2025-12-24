/*
  Usage notes (modes update):
  - This storage manager now namespaces game saves by mode + board size to avoid cross-mode corruption.
  - Settings persisted:
      * boardSize (4 or 5)
      * hardModeEnabled (true/false)
      * timeAttackEnabled (true/false)
  - High scores:
      * bestScore (classic/hard per board size+hard flag)
      * bestTimeAttackScore (time-attack per board size+hard flag)
*/

window.fakeStorage = {
  _data: {},

  setItem: function (id, val) {
    return this._data[id] = String(val);
  },

  getItem: function (id) {
    return this._data.hasOwnProperty(id) ? this._data[id] : undefined;
  },

  removeItem: function (id) {
    return delete this._data[id];
  },

  clear: function () {
    return this._data = {};
  }
};

function LocalStorageManager(storageKeyPrefix) {
  // storageKeyPrefix is a mode+size namespace, e.g. "2048:v2:s4:ta0:h0"
  this.storageKeyPrefix = storageKeyPrefix || "2048:v2:s4:ta0:h0";

  this.bestScoreKey = this.storageKeyPrefix + ":bestScore";
  this.bestTimeAttackScoreKey = this.storageKeyPrefix + ":bestTimeAttackScore";
  this.gameStateKey = this.storageKeyPrefix + ":gameState";

  // Current-run stats (namespaced)
  this.statsKey = this.storageKeyPrefix + ":stats";

  // Global (non-namespaced) keys for UI selections
  this.settingsKeyPrefix = "2048:v2:settings";
  this.boardSizeKey = this.settingsKeyPrefix + ":boardSize";
  this.hardModeKey = this.settingsKeyPrefix + ":hardModeEnabled";
  this.timeAttackKey = this.settingsKeyPrefix + ":timeAttackEnabled";

  var supported = this.localStorageSupported();
  this.storage = supported ? window.localStorage : window.fakeStorage;
}

LocalStorageManager.prototype.localStorageSupported = function () {
  var testKey = "test";

  try {
    var storage = window.localStorage;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

// --- Settings (global) ---
LocalStorageManager.prototype.getBoardSize = function () {
  var raw = this.storage.getItem(this.boardSizeKey);
  var size = parseInt(raw, 10);
  return (size === 5 || size === 4) ? size : 4;
};

LocalStorageManager.prototype.setBoardSize = function (size) {
  this.storage.setItem(this.boardSizeKey, String(size));
};

LocalStorageManager.prototype.getHardModeEnabled = function () {
  return this.storage.getItem(this.hardModeKey) === "true";
};

LocalStorageManager.prototype.setHardModeEnabled = function (enabled) {
  this.storage.setItem(this.hardModeKey, enabled ? "true" : "false");
};

LocalStorageManager.prototype.getTimeAttackEnabled = function () {
  return this.storage.getItem(this.timeAttackKey) === "true";
};

LocalStorageManager.prototype.setTimeAttackEnabled = function (enabled) {
  this.storage.setItem(this.timeAttackKey, enabled ? "true" : "false");
};

// --- Best score getters/setters (namespaced) ---
LocalStorageManager.prototype.getBestScore = function () {
  return parseInt(this.storage.getItem(this.bestScoreKey), 10) || 0;
};

LocalStorageManager.prototype.setBestScore = function (score) {
  this.storage.setItem(this.bestScoreKey, String(score));
};

LocalStorageManager.prototype.getBestTimeAttackScore = function () {
  return parseInt(this.storage.getItem(this.bestTimeAttackScoreKey), 10) || 0;
};

LocalStorageManager.prototype.setBestTimeAttackScore = function (score) {
  this.storage.setItem(this.bestTimeAttackScoreKey, String(score));
};

// --- Game state getters/setters and clearing (namespaced) ---
LocalStorageManager.prototype.getGameState = function () {
  var stateJSON = this.storage.getItem(this.gameStateKey);
  return stateJSON ? JSON.parse(stateJSON) : null;
};

LocalStorageManager.prototype.setGameState = function (gameState) {
  this.storage.setItem(this.gameStateKey, JSON.stringify(gameState));
};

LocalStorageManager.prototype.clearGameState = function () {
  this.storage.removeItem(this.gameStateKey);
};

// --- Current-run stats getters/setters (namespaced) ---

LocalStorageManager.prototype._defaultStats = function () {
  return { moves: 0, highestTile: 0, mergeCounts: {} };
};

LocalStorageManager.prototype._sanitizeStats = function (stats) {
  // Keep schema stable across refreshes and legacy states.
  var d = this._defaultStats();
  if (!stats || typeof stats !== "object") return d;

  var moves = (typeof stats.moves === "number" && isFinite(stats.moves)) ? stats.moves : d.moves;
  var highestTile = (typeof stats.highestTile === "number" && isFinite(stats.highestTile)) ? stats.highestTile : d.highestTile;

  var mergeCounts = {};
  if (stats.mergeCounts && typeof stats.mergeCounts === "object") {
    Object.keys(stats.mergeCounts).forEach(function (k) {
      var v = stats.mergeCounts[k];
      var keyNum = parseInt(k, 10);
      if (!isFinite(keyNum) || keyNum <= 0) return;
      var count = (typeof v === "number" && isFinite(v) && v > 0) ? Math.floor(v) : 0;
      if (count > 0) mergeCounts[String(keyNum)] = count;
    });
  }

  return {
    moves: Math.max(0, Math.floor(moves)),
    highestTile: Math.max(0, Math.floor(highestTile)),
    mergeCounts: mergeCounts
  };
};

// PUBLIC_INTERFACE
LocalStorageManager.prototype.getStats = function () {
  /** Get current-run stats for this mode/size namespace. */
  var raw = this.storage.getItem(this.statsKey);
  if (!raw) return this._defaultStats();
  try {
    return this._sanitizeStats(JSON.parse(raw));
  } catch (e) {
    return this._defaultStats();
  }
};

// PUBLIC_INTERFACE
LocalStorageManager.prototype.setStats = function (stats) {
  /** Persist current-run stats for this mode/size namespace. */
  var safe = this._sanitizeStats(stats);
  this.storage.setItem(this.statsKey, JSON.stringify(safe));
};

// PUBLIC_INTERFACE
LocalStorageManager.prototype.clearStats = function () {
  /** Clear current-run stats for this mode/size namespace (does not affect best scores). */
  this.storage.removeItem(this.statsKey);
};

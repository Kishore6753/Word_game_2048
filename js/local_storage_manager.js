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

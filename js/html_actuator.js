/*
  Usage notes (modes update):
  - Actuator now:
      * Renders the background grid dynamically for 4x4 or 5x5 (instead of static HTML-only 4x4)
      * Shows mode badges (Hard / Time-attack)
      * Shows a countdown timer for time-attack and keeps "Best" display in sync
  - Tile DOM stability and animation behavior is preserved (existing id-based renderer is kept).
*/

function HTMLActuator() {
  this.tileContainer = document.querySelector(".tile-container");
  this.scoreContainer = document.querySelector(".score-container");
  this.bestContainer = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");

  // New mode UI references (optional if markup missing)
  this.gridContainer = document.querySelector(".grid-container");
  this.timeAttackStatus = document.querySelector(".time-attack-status");
  this.timeRemainingEl = document.querySelector(".time-remaining");
  this.hardBadge = document.querySelector(".hard-badge");
  this.timeBadge = document.querySelector(".time-badge");

  // Stats UI references (optional if markup missing)
  this.statsPanel = document.querySelector(".stats-panel");
  this.statsMovesEl = document.querySelector(".stats-moves");
  this.statsHighestEl = document.querySelector(".stats-highest");
  this.statsMergeListEl = document.querySelector(".stats-merge-list");
  this.statsResetButton = document.querySelector(".stats-reset-button");

  this.score = 0;

  // Track DOM elements by tile id so we can animate movement smoothly
  this.tiles = Object.create(null);

  // Track last rendered board size so we can rebuild background grid
  this._lastSize = null;

  // Label elements on score panels (created once)
  this._bestLabelEl = null;

  // Cache for stats rendering to avoid unnecessary DOM updates
  this._lastStatsHash = "";
  this._mergeItemEls = Object.create(null);

  // Wire reset stats button to input manager via a DOM event.
  // KeyboardInputManager listens for this event and forwards to GameManager.
  if (this.statsResetButton) {
    this.statsResetButton.addEventListener("click", function () {
      var ev = new window.CustomEvent("resetStats");
      window.dispatchEvent(ev);
    });
  }
}

/**
 * Create a stable id for tiles so we can keep DOM nodes across frames.
 * Older save-games don't have ids, so we assign them on first render.
 */
HTMLActuator.prototype.ensureTileId = function (tile) {
  if (tile.id == null) {
    // Use a monotonic counter stored on the actuator instance.
    this._nextTileId = (this._nextTileId || 1);
    tile.id = this._nextTileId++;
  }
  return tile.id;
};

/**
 * Flatten grid into an array of tiles.
 */
HTMLActuator.prototype.collectTiles = function (grid) {
  var tiles = [];
  grid.cells.forEach(function (column) {
    column.forEach(function (cell) {
      if (cell) tiles.push(cell);
    });
  });
  return tiles;
};

HTMLActuator.prototype.formatTime = function (ms) {
  var totalSeconds = Math.ceil(ms / 1000);
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;
  return minutes + ":" + (seconds < 10 ? "0" + seconds : seconds);
};

HTMLActuator.prototype._hashStats = function (stats) {
  if (!stats) return "";
  // Stable hash for quick equality check; keys are numeric tile values stored as strings.
  var mergeKeys = (stats.mergeCounts && typeof stats.mergeCounts === "object")
    ? Object.keys(stats.mergeCounts).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); })
    : [];
  var parts = ["m=" + (stats.moves || 0), "h=" + (stats.highestTile || 0)];
  for (var i = 0; i < mergeKeys.length; i++) {
    var k = mergeKeys[i];
    parts.push(k + ":" + (stats.mergeCounts[k] || 0));
  }
  return parts.join("|");
};

HTMLActuator.prototype.renderStats = function (stats) {
  if (!this.statsPanel) return;

  stats = stats || { moves: 0, highestTile: 0, mergeCounts: {} };

  var hash = this._hashStats(stats);
  if (hash === this._lastStatsHash) return;
  this._lastStatsHash = hash;

  if (this.statsMovesEl) this.statsMovesEl.textContent = String(stats.moves || 0);
  if (this.statsHighestEl) this.statsHighestEl.textContent = String(stats.highestTile || 0);

  if (!this.statsMergeListEl) return;

  var mergeCounts = stats.mergeCounts || {};
  var keys = Object.keys(mergeCounts)
    .filter(function (k) { return (mergeCounts[k] || 0) > 0; })
    .sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });

  // Track which list items remain active after render.
  var active = Object.create(null);

  for (var i = 0; i < keys.length; i++) {
    var value = keys[i];
    var count = mergeCounts[value] || 0;
    var li = this._mergeItemEls[value];

    if (!li) {
      li = document.createElement("li");
      li.className = "stats-merge-item";
      li.setAttribute("aria-label", "Merged into " + value + " tile " + count + " times");
      li.dataset.tileValue = value;

      var label = document.createElement("span");
      label.className = "stats-merge-value";
      label.textContent = value;

      var cnt = document.createElement("span");
      cnt.className = "stats-merge-count";
      cnt.textContent = String(count);

      li.appendChild(label);
      li.appendChild(cnt);

      this._mergeItemEls[value] = li;
    } else {
      // Update count & aria label only if changed.
      var countEl = li.querySelector(".stats-merge-count");
      if (countEl && countEl.textContent !== String(count)) {
        countEl.textContent = String(count);
      }
      li.setAttribute("aria-label", "Merged into " + value + " tile " + count + " times");
    }

    active[value] = true;
  }

  // Remove stale items from DOM and cache
  Object.keys(this._mergeItemEls).forEach(function (value) {
    if (!active[value]) {
      var el = this._mergeItemEls[value];
      if (el && el.parentNode) el.parentNode.removeChild(el);
      delete this._mergeItemEls[value];
    }
  }, this);

  // Append in correct order (move existing nodes as needed).
  for (var j = 0; j < keys.length; j++) {
    var v = keys[j];
    this.statsMergeListEl.appendChild(this._mergeItemEls[v]);
  }

  // Empty state
  if (keys.length === 0) {
    // Keep a single lightweight placeholder node.
    if (!this._emptyMergeEl) {
      var empty = document.createElement("li");
      empty.className = "stats-merge-empty";
      empty.textContent = "No merges yet";
      empty.setAttribute("aria-label", "No merges yet");
      this._emptyMergeEl = empty;
    }
    this.statsMergeListEl.appendChild(this._emptyMergeEl);
  } else if (this._emptyMergeEl && this._emptyMergeEl.parentNode) {
    this._emptyMergeEl.parentNode.removeChild(this._emptyMergeEl);
  }
};

/**
 * Build/rebuild the background grid markup for the given size.
 * This keeps the visual board correct for 5x5 while leaving tile positioning CSS-based.
 */
HTMLActuator.prototype.renderBackgroundGrid = function (size) {
  if (!this.gridContainer) return;
  if (this._lastSize === size) return;

  this._lastSize = size;

  // Clear existing cells
  while (this.gridContainer.firstChild) {
    this.gridContainer.removeChild(this.gridContainer.firstChild);
  }

  for (var y = 0; y < size; y++) {
    var row = document.createElement("div");
    row.className = "grid-row";
    for (var x = 0; x < size; x++) {
      var cell = document.createElement("div");
      cell.className = "grid-cell";
      row.appendChild(cell);
    }
    this.gridContainer.appendChild(row);
  }
};

/**
 * Update the "Best" label text on the best container to reflect time-attack.
 */
HTMLActuator.prototype.updateBestLabel = function (isTimeAttack) {
  // The label is a ::after in CSS, but we can override with data-attribute + CSS hook.
  // Keep it simple: add/remove a class and let CSS content switch.
  // If CSS hook isn't present, we fallback to adding an inline label element.
  var container = this.bestContainer;
  if (!container) return;

  if (isTimeAttack) {
    container.classList.add("best-time-attack");
  } else {
    container.classList.remove("best-time-attack");
  }

  // Fallback label (for older CSS): inject a small absolute label if needed.
  if (!this._bestLabelEl) {
    var existing = container.querySelector(".best-label");
    if (existing) {
      this._bestLabelEl = existing;
    } else {
      var label = document.createElement("div");
      label.className = "best-label";
      label.textContent = "Best";
      label.style.position = "absolute";
      label.style.top = "10px";
      label.style.left = "0";
      label.style.width = "100%";
      label.style.textTransform = "uppercase";
      label.style.fontSize = "13px";
      label.style.lineHeight = "13px";
      label.style.textAlign = "center";
      label.style.color = "#eee4da";
      container.appendChild(label);
      this._bestLabelEl = label;
    }
  }

  this._bestLabelEl.textContent = isTimeAttack ? "Best (TA)" : "Best";
};

/**
 * PUBLIC_INTERFACE
 * Render the new game state.
 * We keep DOM nodes stable and only update classes/positions, which lets CSS transitions animate movement.
 */
HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    var size = (metadata && metadata.mode && metadata.mode.size) ? metadata.mode.size : grid.size;

    // Toggle size class for CSS-based positioning (4x4 uses existing rules; 5x5 uses modes.css).
    var gameContainer = document.getElementsByClassName("game-container")[0];
    if (gameContainer) {
      if (size === 5) gameContainer.classList.add("size-5");
      else gameContainer.classList.remove("size-5");
    }

    self.renderBackgroundGrid(size);

    // Update badges/timer
    var isHard = !!(metadata && metadata.mode && metadata.mode.hard);
    var isTimeAttack = !!(metadata && metadata.mode && metadata.mode.timeAttack);

    if (self.hardBadge) self.hardBadge.hidden = !isHard;
    if (self.timeBadge) self.timeBadge.hidden = !isTimeAttack;

    if (self.timeAttackStatus) {
      self.timeAttackStatus.hidden = !isTimeAttack;
    }
    if (self.timeRemainingEl) {
      if (isTimeAttack && typeof metadata.timeRemainingMs === "number") {
        self.timeRemainingEl.textContent = self.formatTime(metadata.timeRemainingMs);
        if (metadata.timeRemainingMs <= 15000) {
          self.timeRemainingEl.classList.add("time-low");
        } else {
          self.timeRemainingEl.classList.remove("time-low");
        }
      } else {
        self.timeRemainingEl.textContent = "2:00";
        self.timeRemainingEl.classList.remove("time-low");
      }
    }

    self.updateBestLabel(isTimeAttack);

    // Build a set of ids that must exist after this render.
    var tiles = self.collectTiles(grid);
    var activeIds = Object.create(null);

    // Ensure ids exist for current tile and its mergedFrom sources.
    tiles.forEach(function (tile) {
      self.ensureTileId(tile);
      if (tile.mergedFrom) {
        tile.mergedFrom.forEach(function (src) {
          self.ensureTileId(src);
        });
      }
    });

    // First: render/update all mergedFrom source tiles.
    tiles.forEach(function (tile) {
      if (!tile.mergedFrom) return;
      tile.mergedFrom.forEach(function (src) {
        activeIds[src.id] = true;
        self.updateOrCreateTile(src, { isMergeSource: true });
      });
    });

    // Second: render/update all main tiles.
    tiles.forEach(function (tile) {
      activeIds[tile.id] = true;
      self.updateOrCreateTile(tile, { isMergeTarget: !!tile.mergedFrom });
    });

    // Remove tiles that are no longer present.
    Object.keys(self.tiles).forEach(function (id) {
      if (!activeIds[id]) {
        var el = self.tiles[id];
        if (el && el.parentNode) el.parentNode.removeChild(el);
        delete self.tiles[id];
      }
    });

    // Stats panel (render after tiles are updated; does not affect tile animation sequencing)
    if (metadata && metadata.stats) {
      self.renderStats(metadata.stats);
    } else {
      self.renderStats({ moves: 0, highestTile: 0, mergeCounts: {} });
    }

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);

    if (metadata.terminated) {
      if (metadata.over) {
        self.message(false); // You lose
      } else if (metadata.won) {
        self.message(true); // You win!
      } else if (isTimeAttack) {
        self.message("time"); // Time's up
      }
    }
  });
};

// Continues the game (both restart and keep playing)
HTMLActuator.prototype.continueGame = function () {
  this.clearMessage();
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

/**
 * Create a tile element and register it.
 */
HTMLActuator.prototype.createTileElement = function (tile) {
  var wrapper = document.createElement("div");
  var inner = document.createElement("div");
  inner.classList.add("tile-inner");
  inner.textContent = tile.value;

  wrapper.appendChild(inner);
  wrapper.dataset.tileId = String(tile.id);

  this.tileContainer.appendChild(wrapper);
  this.tiles[tile.id] = wrapper;

  return wrapper;
};

/**
 * Update/create tile node and schedule class changes to ensure transitions fire.
 */
HTMLActuator.prototype.updateOrCreateTile = function (tile, options) {
  var self = this;
  options = options || {};

  var id = this.ensureTileId(tile);
  var existing = this.tiles[id];
  var wrapper = existing || this.createTileElement(tile);
  var inner = wrapper.querySelector(".tile-inner");

  inner.textContent = tile.value;

  var position = tile.previousPosition || { x: tile.x, y: tile.y };
  var fromClass = this.positionClass(position);
  var toClass = this.positionClass({ x: tile.x, y: tile.y });

  var classes = ["tile", "tile-" + tile.value, fromClass];

  if (tile.value > 2048) classes.push("tile-super");

  if (tile.previousPosition && (tile.previousPosition.x !== tile.x || tile.previousPosition.y !== tile.y)) {
    classes.push("tile-moving");
  }

  if (options.isMergeTarget) {
    classes.push("tile-merged");
  }

  if (!tile.previousPosition && !options.isMergeTarget) {
    classes.push("tile-new");
  }

  this.applyClasses(wrapper, classes);

  // Force initial state to register
  // eslint-disable-next-line no-unused-expressions
  wrapper.offsetWidth;

  if (fromClass !== toClass) {
    window.requestAnimationFrame(function () {
      classes[2] = toClass;
      self.applyClasses(wrapper, classes);
    });
  } else if (options.isMergeTarget) {
    window.requestAnimationFrame(function () {
      self.applyClasses(wrapper, classes);
    });
  }
};

HTMLActuator.prototype.updateScore = function (score) {
  while (this.scoreContainer.firstChild) {
    this.scoreContainer.removeChild(this.scoreContainer.firstChild);
  }

  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.textContent = this.score;

  if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + difference;

    this.scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
  this.bestContainer.textContent = bestScore;
};

HTMLActuator.prototype.message = function (won) {
  var type, message;

  if (won === "time") {
    type = "game-over";
    message = "Time!";
  } else {
    type = won ? "game-won" : "game-over";
    message = won ? "You win!" : "Game over!";
  }

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};

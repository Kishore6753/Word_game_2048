function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.querySelector(".score-container");
  this.bestContainer    = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");

  this.score = 0;

  // Track DOM elements by tile id so we can animate movement smoothly
  this.tiles = Object.create(null);
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
 * Flatten grid into an array of tiles (including mergedFrom tiles so we can animate them too).
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

/**
 * PUBLIC_INTERFACE
 * Render the new game state.
 * We keep DOM nodes stable and only update classes/positions, which lets CSS transitions animate movement.
 */
HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    // Build a set of ids that must exist after this render.
    var tiles = self.collectTiles(grid);
    var activeIds = Object.create(null);

    // Create/update tiles in a stable order. Also render mergedFrom tiles (the "sources")
    // so the merge animation doesn't visually double-merge.
    tiles.forEach(function (tile) {
      // Ensure ids exist for current tile and its mergedFrom sources.
      self.ensureTileId(tile);
      if (tile.mergedFrom) {
        tile.mergedFrom.forEach(function (src) {
          self.ensureTileId(src);
        });
      }
    });

    // First: render/update all mergedFrom source tiles (so they can move into the merge target).
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

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);

    if (metadata.terminated) {
      if (metadata.over) {
        self.message(false); // You lose
      } else if (metadata.won) {
        self.message(true); // You win!
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
 *
 * Options:
 * - isMergeSource: when true, tile is one of the source tiles that will be removed after the merge.
 * - isMergeTarget: when true, tile is the resulting merged tile (gets bump/highlight).
 */
HTMLActuator.prototype.updateOrCreateTile = function (tile, options) {
  var self = this;
  options = options || {};

  var id = this.ensureTileId(tile);
  var existing = this.tiles[id];
  var wrapper = existing || this.createTileElement(tile);
  var inner = wrapper.querySelector(".tile-inner");

  // Update text/value (for merge targets the value has already changed in game logic).
  inner.textContent = tile.value;

  var position = tile.previousPosition || { x: tile.x, y: tile.y };
  var fromClass = this.positionClass(position);
  var toClass = this.positionClass({ x: tile.x, y: tile.y });

  var classes = ["tile", "tile-" + tile.value, fromClass];

  if (tile.value > 2048) classes.push("tile-super");

  // Mark movement intent (purely for styling hooks / potential future use).
  if (tile.previousPosition && (tile.previousPosition.x !== tile.x || tile.previousPosition.y !== tile.y)) {
    classes.push("tile-moving");
  }

  if (options.isMergeTarget) {
    classes.push("tile-merged");
  }

  // New tile (no previous position and not a merge target)
  if (!tile.previousPosition && !options.isMergeTarget) {
    classes.push("tile-new");
  }

  // Apply initial classes at the "from" position.
  this.applyClasses(wrapper, classes);

  // Force the browser to register initial state, then apply the "to" state in next frame.
  // This ensures transform transitions reliably trigger without layout thrash (one read).
  // eslint-disable-next-line no-unused-expressions
  wrapper.offsetWidth;

  if (fromClass !== toClass) {
    window.requestAnimationFrame(function () {
      // Replace position class to the destination position.
      classes[2] = toClass;
      self.applyClasses(wrapper, classes);
    });
  } else if (options.isMergeTarget) {
    // Even if it didn't move, still schedule merge "bump" so it plays after paint.
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
  var type    = won ? "game-won" : "game-over";
  var message = won ? "You win!" : "Game over!";

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  // IE only takes one value to remove at a time.
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};

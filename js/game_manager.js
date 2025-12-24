/*
  Usage notes (modes update):
  - GameManager now supports:
      * board sizes: 4x4 (default) and 5x5
      * hard mode: starts with 1 tile and spawns 4s at 50% (instead of 10%)
      * time-attack: 2-minute countdown; input freezes at 0 and final score is shown
  - Saves and best scores are managed via a mode+size namespaced LocalStorageManager instance.
*/

function GameManager(size, InputManager, Actuator, StorageManager, options) {
  options = options || {};

  this.size = size; // Size of the grid
  this.inputManager = new InputManager;
  this.storageManager = new StorageManager(options.storageKeyPrefix);
  this.actuator = new Actuator;

  this.mode = {
    hard: !!options.hardMode,
    timeAttack: !!options.timeAttack,
    timeLimitMs: typeof options.timeLimitMs === "number" ? options.timeLimitMs : (2 * 60 * 1000)
  };

  // Hard mode rule: fewer starting tiles.
  this.startTiles = this.mode.hard ? 1 : 2;

  // Time-attack runtime state
  this.timeAttack = {
    remainingMs: this.mode.timeLimitMs,
    running: false,
    ended: false,
    intervalId: null
  };

  // Stats runtime state (moves, highest tile, per-value merge counts)
  // Persisted per mode/size namespace via LocalStorageManager.
  this.stats = this.storageManager.getStats();

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  // Stats-only reset (does not affect best score or current grid)
  this.inputManager.on("resetStats", this.handleResetStats.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.stopTimer();
  this.storageManager.clearGameState();

  // Reset current-run stats (does not touch best score).
  this.resetStats();

  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// PUBLIC_INTERFACE
GameManager.prototype.handleResetStats = function () {
  /** Reset current-run stats without affecting score, best score, or game state. */
  this.resetStats();
  // Highest tile should reflect current grid right after reset.
  this.updateHighestTileFromGrid();
  this.storageManager.setStats(this.stats);
  this.actuate();
};

// Return true if the game is lost, or has won and the user hasn't kept playing, or time-attack ended
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying) || (this.mode.timeAttack && this.timeAttack.ended);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present (for this namespace)
  if (previousState) {
    this.grid = new Grid(previousState.grid.size,
                         previousState.grid.cells); // Reload grid
    this.score = previousState.score;
    this.over = previousState.over;
    this.won = previousState.won;
    this.keepPlaying = previousState.keepPlaying;

    // Restore time-attack remaining time if applicable.
    if (this.mode.timeAttack) {
      this.timeAttack.remainingMs = typeof previousState.timeRemainingMs === "number"
        ? previousState.timeRemainingMs
        : this.mode.timeLimitMs;
      this.timeAttack.ended = !!previousState.timeEnded;
    } else {
      // Ensure non-TA mode doesn't inherit stale values.
      this.timeAttack.remainingMs = this.mode.timeLimitMs;
      this.timeAttack.ended = false;
    }

    // Restore current-run stats for this namespace.
    this.stats = this.storageManager.getStats();
  } else {
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;

    if (this.mode.timeAttack) {
      this.timeAttack.remainingMs = this.mode.timeLimitMs;
      this.timeAttack.ended = false;
    }

    // New run => fresh stats
    this.resetStats();

    // Add the initial tiles
    this.addStartTiles();
  }

  // Ensure highest tile reflects current grid after load / initialization.
  this.updateHighestTileFromGrid();

  // Start timer if needed and game not ended
  if (this.mode.timeAttack && !this.timeAttack.ended) {
    this.startTimer();
  } else {
    this.stopTimer();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    // Hard mode: spawn 4s more often (50%)
    var fourProbability = this.mode.hard ? 0.5 : 0.1;
    var value = Math.random() < (1 - fourProbability) ? 2 : 4;

    var tile = new Tile(this.grid.randomAvailableCell(), value);
    this.grid.insertTile(tile);
  }
};

// PUBLIC_INTERFACE
GameManager.prototype.getBestScoreForCurrentMode = function () {
  /** Get the relevant best score (normal vs time-attack) for current mode namespace. */
  return this.mode.timeAttack
    ? this.storageManager.getBestTimeAttackScore()
    : this.storageManager.getBestScore();
};

// Update best score for current mode
GameManager.prototype.updateBestScoreForCurrentMode = function () {
  var best = this.getBestScoreForCurrentMode();
  if (this.score > best) {
    if (this.mode.timeAttack) {
      this.storageManager.setBestTimeAttackScore(this.score);
    } else {
      this.storageManager.setBestScore(this.score);
    }
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  this.updateBestScoreForCurrentMode();

  // Clear the state when the game is over (game over only, not win; time-attack still shows end state)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score: this.score,
    over: this.over,
    won: this.won,
    bestScore: this.getBestScoreForCurrentMode(),
    terminated: this.isGameTerminated(),

    // Stats metadata for UI (current-run only)
    stats: this.stats,

    // Mode metadata for UI
    mode: {
      size: this.size,
      hard: this.mode.hard,
      timeAttack: this.mode.timeAttack
    },
    timeRemainingMs: this.mode.timeAttack ? this.timeAttack.remainingMs : null
  });
};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid: this.grid.serialize(),
    score: this.score,
    over: this.over,
    won: this.won,
    keepPlaying: this.keepPlaying,

    // time-attack state is saved only within this namespace
    timeRemainingMs: this.mode.timeAttack ? this.timeAttack.remainingMs : null,
    timeEnded: this.mode.timeAttack ? this.timeAttack.ended : null
  };
};

GameManager.prototype.startTimer = function () {
  var self = this;
  if (!this.mode.timeAttack) return;
  if (this.timeAttack.intervalId != null) return;

  this.timeAttack.running = true;

  // Tick 5x/sec for smoother UI without excessive work.
  this.timeAttack.intervalId = window.setInterval(function () {
    if (self.timeAttack.ended || self.over) return;

    self.timeAttack.remainingMs = Math.max(0, self.timeAttack.remainingMs - 200);

    if (self.timeAttack.remainingMs === 0) {
      self.endTimeAttack();
      return;
    }

    // Persist remaining time so reloads don't reset the clock for that namespace.
    self.storageManager.setGameState(self.serialize());
    self.actuate();
  }, 200);
};

GameManager.prototype.stopTimer = function () {
  if (this.timeAttack.intervalId != null) {
    window.clearInterval(this.timeAttack.intervalId);
    this.timeAttack.intervalId = null;
  }
  this.timeAttack.running = false;
};

GameManager.prototype.endTimeAttack = function () {
  if (!this.mode.timeAttack) return;
  this.timeAttack.ended = true;
  this.stopTimer();

  // Persist end state (so reload shows it ended) but do not clear (like game-over).
  this.storageManager.setGameState(this.serialize());
  this.actuate();
};

// PUBLIC_INTERFACE
GameManager.prototype.resetStats = function () {
  /** Reset current-run stats for this namespace (moves, highest tile, merge counts). */
  this.stats = { moves: 0, highestTile: 0, mergeCounts: {} };
  this.storageManager.setStats(this.stats);
};

// PUBLIC_INTERFACE
GameManager.prototype.updateHighestTileFromGrid = function () {
  /** Recompute highest tile from current grid and persist if it increases. */
  var maxVal = 0;
  this.grid.eachCell(function (x, y, tile) {
    if (tile && tile.value > maxVal) maxVal = tile.value;
  });
  if (maxVal > (this.stats.highestTile || 0)) {
    this.stats.highestTile = maxVal;
    this.storageManager.setStats(this.stats);
  }
};

GameManager.prototype.incrementMoveStat = function () {
  this.stats.moves = (this.stats.moves || 0) + 1;
};

GameManager.prototype.recordMergeStat = function (resultValue) {
  var key = String(resultValue);
  if (!this.stats.mergeCounts) this.stats.mergeCounts = {};
  this.stats.mergeCounts[key] = (this.stats.mergeCounts[key] || 0) + 1;

  if (resultValue > (this.stats.highestTile || 0)) {
    this.stats.highestTile = resultValue;
  }
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved = false;

  // Track merge events for this move (can be multiple in one move)
  var mergedValuesThisMove = [];

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var mergedValue = tile.value * 2;
          var merged = new Tile(positions.next, mergedValue);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // Stats: record merge by resulting value
          mergedValuesThisMove.push(mergedValue);

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    // Stats: increment move count only for valid moves
    this.incrementMoveStat();

    // Stats: record all merges from this move
    for (var i = 0; i < mergedValuesThisMove.length; i++) {
      this.recordMergeStat(mergedValuesThisMove[i]);
    }

    this.addRandomTile();

    // Stats: highest tile may increase due to spawn as well (e.g., when continuing after load)
    this.updateHighestTileFromGrid();

    // Persist stats for refresh continuity (mode-aware via storageKeyPrefix)
    this.storageManager.setStats(this.stats);

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
      this.stopTimer();
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell = { x: x + vector.x, y: y + vector.y };

          var other = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

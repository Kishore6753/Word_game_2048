function Tile(position, value) {
  this.x                = position.x;
  this.y                = position.y;
  this.value            = value || 2;

  // Used by the actuator to animate movement; does not affect game rules.
  this.previousPosition = null;
  this.mergedFrom       = null; // Tracks tiles that merged together

  // Stable id for DOM mapping (purely visual; safe for gameplay).
  this.id               = null;
}

Tile.prototype.savePosition = function () {
  this.previousPosition = { x: this.x, y: this.y };
};

Tile.prototype.updatePosition = function (position) {
  this.x = position.x;
  this.y = position.y;
};

Tile.prototype.serialize = function () {
  return {
    position: {
      x: this.x,
      y: this.y
    },
    value: this.value
    // Intentionally not serializing id; it is visual-only and can be regenerated.
  };
};

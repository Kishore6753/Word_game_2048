/**
 * Theme handling: applies a `dark-theme` class on the <html> element.
 * Preference is persisted using localStorage; if unavailable, falls back to the
 * existing fakeStorage shim (window.fakeStorage).
 */
function ThemeManager() {
  this.themeKey = "theme";
  this.storage = this._getStorage();
}

ThemeManager.prototype._getStorage = function () {
  try {
    var testKey = "__theme_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    // window.fakeStorage is defined by local_storage_manager.js, which is loaded
    // before this file in index.html.
    return window.fakeStorage || {
      getItem: function () { return null; },
      setItem: function () {}
    };
  }
};

ThemeManager.prototype.getTheme = function () {
  return this.storage.getItem(this.themeKey);
};

ThemeManager.prototype.setTheme = function (theme) {
  this.storage.setItem(this.themeKey, theme);
};

ThemeManager.prototype._applyThemeToDocument = function (theme) {
  var root = document.documentElement;
  var isDark = theme === "dark";
  root.classList.toggle("dark-theme", isDark);
  return isDark;
};

ThemeManager.prototype.init = function () {
  var preferred = this.getTheme();

  // Default to system preference if user hasn't chosen yet.
  if (!preferred) {
    var prefersDark = false;
    try {
      prefersDark = window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      prefersDark = false;
    }
    preferred = prefersDark ? "dark" : "light";
  }

  var isDark = this._applyThemeToDocument(preferred);

  // Update the toggle button UI if present.
  var button = document.querySelector(".theme-toggle-button");
  if (button) {
    this._syncButton(button, isDark);

    button.addEventListener("click", function () {
      isDark = !document.documentElement.classList.contains("dark-theme");
      document.documentElement.classList.toggle("dark-theme", isDark);
      this.setTheme(isDark ? "dark" : "light");
      this._syncButton(button, isDark);
    }.bind(this));
  }
};

ThemeManager.prototype._syncButton = function (button, isDark) {
  button.setAttribute("aria-pressed", isDark ? "true" : "false");
  button.textContent = isDark ? "Light mode" : "Dark mode";
  button.title = isDark ? "Switch to light mode" : "Switch to dark mode";
};

// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  // Initialize theme before creating game UI (so initial paint is correct).
  var themeManager = new ThemeManager();
  themeManager.init();

  new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});

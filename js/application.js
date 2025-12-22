 /* INTENTIONAL TEST BREAKAGE: Remove this block to restore the app
    Purpose: Switch failure mode to a fatal JS syntax error so parsing stops before any code runs.
    How to fix: Delete the next line (or this entire comment block). */
 const = ; // intentional fatal syntax error

 // Wait till the browser is ready to render the game (avoids glitches)
 window.requestAnimationFrame(function () {
   new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
 });

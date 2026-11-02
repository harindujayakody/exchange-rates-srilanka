// Runs before first paint (a file, not inline, because the CSP blocks inline scripts): applies the saved theme,
// or the device setting when none is saved, so the page never flashes the wrong colours.
try {
  var saved = localStorage.getItem('theme');
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}

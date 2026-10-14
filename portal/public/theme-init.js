// Sets data-theme before first paint so a dark-mode reader never sees a cream
// flash. Loaded as a blocking same-origin script, not inline, because the
// production CSP is script-src 'self'. Mirrors resolveTheme() in
// src/lib/theme.tsx: keep the two in step.
(function () {
  var pref = "system";
  try {
    var stored = localStorage.getItem("pb-theme");
    if (stored === "light" || stored === "dark" || stored === "system") pref = stored;
  } catch (e) {}
  var dark =
    pref === "dark" ||
    (pref === "system" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", dark ? "#1A1411" : "#FAF6F1");
})();

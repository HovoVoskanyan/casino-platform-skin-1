/* ChoCho site helper — one definition of destinations, preview session,
   auth entry/return targets, game origin and neutral notices.
   Load with <script src="chocho-site.js"></script> inside <helmet>.
   Nothing here authenticates anyone: "signed-in" is an internal review
   fixture selected through Tweaks (previewSession) or the QA board. */
(function () {
  if (window.ChoChoSite) return;

  var PAGES = {
    home: "ChoCho Home.dc.html",
    games: "ChoCho Games.dc.html",
    promotions: "ChoCho Promotions.dc.html",
    vip: "ChoCho VIP.dc.html",
    wallet: "ChoCho Wallet.dc.html",
    account: "ChoCho My Account.dc.html",
    "sweet-bonanza": "ChoCho Sweet Bonanza.dc.html",
    info: "ChoCho Info.dc.html"
  };
  /* Secondary information pages: one shared file, one stable ?page= location each.
     Reached from the footer and consent text only — never header or bottom-nav items. */
  var INFO = { "responsible-gaming": "Responsible Gaming", faq: "FAQ", terms: "Terms", privacy: "Privacy" };
  var PROTECTED = { wallet: true, account: true };
  var SESSION_KEY = "chocho:previewSession";
  var RETURN_KEY = "chocho:returnTo";
  var ORIGIN_KEY = "chocho:gameOrigin";

  var listeners = [];
  function emit() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function read(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function write(store, k, v) { try { if (v == null) window[store].removeItem(k); else window[store].setItem(k, v); } catch (e) {} }

  function fileOf(u) {
    var path = String(u || "").split("#")[0].split("?")[0];
    try { path = decodeURIComponent(path); } catch (e) {}
    return path.split("/").pop();
  }
  function keyOfFile(file) {
    for (var k in PAGES) if (PAGES[k] === file) return k;
    return null;
  }

  var api = {
    PAGES: PAGES,
    INFO: INFO,

    /* "games" | "games?category=Slots" | "wallet#deposit" | full internal file name */
    href: function (dest) {
      var s = String(dest || "home");
      var m = s.match(/^([\w-]+)([?#].*)?$/);
      if (m && INFO[m[1]]) return PAGES.info + "?page=" + m[1] + (m[2] ? (m[2].charAt(0) === "?" ? "&" + m[2].slice(1) : m[2]) : "");
      if (m && PAGES[m[1]]) return PAGES[m[1]] + (m[2] || "");
      return api.isInternal(s) ? s : PAGES.home;
    },
    isInternal: function (u) { return !!keyOfFile(fileOf(u)) && !/^[a-z]+:/i.test(String(u)); },
    current: function () { return keyOfFile(fileOf(window.location.pathname)) || "home"; },
    /* Which information page is open ("faq", "terms"…), or null on other pages. */
    infoPage: function () {
      if (api.current() !== "info") return null;
      var p = (window.location.search.match(/[?&]page=([\w-]+)/) || [])[1];
      return INFO[p] ? p : null;
    },
    currentUrl: function () { return fileOf(window.location.pathname) + window.location.search + window.location.hash; },

    session: function () { return read("localStorage", SESSION_KEY) === "signed-in" ? "signed-in" : "guest"; },
    isAuthed: function () { return api.session() === "signed-in"; },
    setSession: function (v) {
      var next = v === "signed-in" ? "signed-in" : "guest";
      if (next === api.session()) return;
      write("localStorage", SESSION_KEY, next);
      if (next === "guest") write("sessionStorage", RETURN_KEY, null);
      emit();
      window.dispatchEvent(new CustomEvent("chocho:session", { detail: { session: next } }));
    },
    /* Maps the older per-page preview props onto the shared state. */
    applyPreviewProp: function (v) {
      if (v == null || v === "" || v === "shared") return;
      var s = String(v).toLowerCase();
      api.setSession(s === "signed-in" || s === "signed in" || s === "auth" || s === "true" ? "signed-in" : "guest");
    },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },

    go: function (dest) {
      var k = String(dest || "").split(/[?#]/)[0];
      if (PROTECTED[k] && !api.isAuthed()) { api.openAuth("signin", dest); return; }
      window.location.href = api.href(dest);
    },
    isProtected: function (k) { return !!PROTECTED[k]; },

    /* Opens the shared auth dialog over the current page. */
    openAuth: function (mode, returnTo) {
      var target = returnTo ? api.href(returnTo) : null;
      write("sessionStorage", RETURN_KEY, target && api.isInternal(target) ? target : null);
      api.pendingAuth = { mode: mode, returnTo: target };
      window.dispatchEvent(new CustomEvent("chocho:auth", { detail: { mode: mode === "register" ? "register" : mode === "reset" ? "reset" : "signin", returnTo: target } }));
    },
    peekReturnTo: function () {
      var t = read("sessionStorage", RETURN_KEY);
      return t && api.isInternal(t) ? t : null;
    },
    consumeReturnTo: function () {
      var t = api.peekReturnTo();
      write("sessionStorage", RETURN_KEY, null);
      return t;
    },

    /* Game detail remembers which catalogue opened it. */
    openGame: function (key) {
      if (!PAGES[key]) return;
      var from = api.currentUrl();
      write("sessionStorage", ORIGIN_KEY, api.isInternal(from) ? from : null);
      window.location.href = PAGES[key];
    },
    gameOrigin: function () {
      var t = read("sessionStorage", ORIGIN_KEY);
      return t && api.isInternal(t) ? t : PAGES.games;
    },

    notice: function (text) { window.dispatchEvent(new CustomEvent("chocho:notice", { detail: { text: String(text || "") } })); },
    unavailable: function (what) { api.notice(what + " isn\u2019t available in this preview yet."); }
  };

  window.ChoChoSite = api;
  window.addEventListener("storage", function (e) { if (e.key === SESSION_KEY) emit(); });
  window.dispatchEvent(new CustomEvent("chocho:site-ready"));
})();

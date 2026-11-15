/* =====================================================================
   RevyzMed — application (JavaScript sans dépendance)
   ===================================================================== */
(function () {
  "use strict";
  var D = window.REVYZ;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $("#app");

  /* ------------------------------------------------------------ stockage */
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var S = Object.assign({ timer: false, timerMode: "q", timerQ: 60, timerT: 25, timerBank: false, instant: false, n: 20 }, load("rv.settings", {}));
  var P = load("rv.progress", {});      // qid -> {s: dernier score 0..1, a: nb tentatives, b: meilleur, t: date}
  var LAST = load("rv.last", {});       // lesson -> index de la dernière question

  /* ------------------------------------------------------------ utilitaires */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inl(s) { return esc(s).replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)]|$)/g, "$1<i>$2</i>").replace(/\n/g, "<br>"); }
  function md(s) { return String(s || "").split(/\n{2,}/).map(function (p) { return "<p>" + inl(p) + "</p>"; }).join(""); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function fmt(x) { return (Math.round(x * 100) / 100).toString().replace(".", ","); }
  function cls(s) { return s >= 0.999 ? "good" : s >= 0.5 ? "mid" : "bad"; }
  function plural(n, w) { return n + " " + w + (n > 1 ? "s" : ""); }

  var IC = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    redo: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    bone: '<path d="M7.5 3.5a2.6 2.6 0 0 0-3.9 3.3A2.6 2.6 0 0 0 6.8 10.6l6.6 6.6a2.6 2.6 0 0 0 3.8 3.2 2.6 2.6 0 0 0 3.3-3.9 2.6 2.6 0 0 0-3.2-3.8L10.6 6.8A2.6 2.6 0 0 0 7.5 3.5z"/>',
    gut: '<path d="M10 3v4.2c0 1.7-1.6 2.4-3 3.6C5 12.4 4.4 15.3 5.6 17.6c1.6 3 5.6 4.1 9.2 2.9 3.3-1.1 5.6-4.2 5-7.2-.5-2.4-2.9-3.5-4.9-2.6-1.4.6-2.1 2-3.6 1.8-1.4-.2-1.5-1.7-1.5-3.2V3"/><path d="M19.9 12.6c.9-.1 1.6.6 1.6 1.6V17"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    quiz: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5L16 9.5"/>',
    play: '<path d="M7 5v14l11-7z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    grip: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  function ic(n, c) { return '<svg viewBox="0 0 24 24"' + (c ? ' class="' + c + '"' : "") + ">" + IC[n] + "</svg>"; }

  /* ------------------------------------------------------------ index de données */
  var LESSONS = D.lessons, Q = D.q;
  var BYLESSON = {};
  D.order.forEach(function (id) { var q = Q[id]; (BYLESSON[q.lesson] = BYLESSON[q.lesson] || []).push(id); });
  function appOf(id) { return D.apps.filter(function (a) { return a.id === id; })[0]; }
  function sepiOf(id) { var r; D.apps.forEach(function (a) { a.sepis.forEach(function (s) { if (s.id === id) r = s; }); }); return r; }
  function qidsOfScope(scope) {
    // scope : "all" | app id | sepi id | lesson id
    if (scope === "all") return D.order.slice();
    if (LESSONS[scope]) return (BYLESSON[scope] || []).slice();
    var s = sepiOf(scope); if (s) return [].concat.apply([], s.lessons.map(function (l) { return BYLESSON[l] || []; }));
    var a = appOf(scope); if (a) return [].concat.apply([], a.sepis.map(function (s) { return qidsOfScope(s.id); }));
    return [];
  }
  function scopeName(scope) {
    if (scope === "all") return "Toutes les leçons";
    if (LESSONS[scope]) return LESSONS[scope].title;
    var s = sepiOf(scope); if (s) return appOf(s.app).name + " · " + s.name;
    var a = appOf(scope); return a ? a.name : scope;
  }
  function stats(ids) {
    var done = 0, sum = 0, err = 0;
    ids.forEach(function (id) { var p = P[id]; if (p) { done++; sum += p.s; if (p.s < 0.999) err++; } });
    return { n: ids.length, done: done, avg: done ? sum / done : 0, err: err, frac: ids.length ? done / ids.length : 0 };
  }

  /* ------------------------------------------------------------ thème */
  var PALS = [["graphite", "Graphite", "#2f3437"], ["blanc", "Blanc", "#f4f4f4"], ["ardoise", "Ardoise", "#4f6274"], ["sauge", "Sauge", "#44705a"],
    ["nuit", "Bleu nuit", "#24395f"], ["prune", "Prune", "#67498a"], ["bordeaux", "Bordeaux", "#8b3a3e"], ["ivoire", "Ivoire", "#c8a874"]];
  function mode() { return document.documentElement.getAttribute("data-mode"); }
  function setMode(m) { document.documentElement.setAttribute("data-mode", m); try { localStorage.setItem("rv.mode", m); } catch (e) {} $("#modeIc").innerHTML = IC[m === "dark" ? "sun" : "moon"]; syncSettings(); }
  function setPal(p) { document.documentElement.setAttribute("data-palette", p); try { localStorage.setItem("rv.palette", p); } catch (e) {} syncSettings(); }
  $("#modeIc").innerHTML = IC[mode() === "dark" ? "sun" : "moon"];
  $("#modeBtn").addEventListener("click", function () { setMode(mode() === "dark" ? "light" : "dark"); });

  /* ------------------------------------------------------------ barre latérale */
  var openTree = load("rv.tree", {});
  function sidebar(active) {
    var h = '<a class="ws" href="#/"><span class="ws-logo">R</span><span><b>RevyzMed</b><small>Fiches &amp; QCM</small></span></a>';
    h += '<div class="nav">';
    h += navLink("#/", "home", "Accueil", active === "home");
    h += navLink("#/recherche", "search", "Recherche", active === "search");
    var errN = stats(D.order).err;
    h += navLink("#/erreurs", "redo", "Revoir mes erreurs" + (errN ? ' <span class="pct">' + errN + "</span>" : ""), active === "errors");
    h += navLink("#/stats", "chart", "Statistiques", active === "stats");
    D.apps.forEach(function (a) {
      h += '<div class="nav-sec">' + esc(a.name) + "</div>";
      a.sepis.forEach(function (s) {
        var open = openTree[s.id] !== false;
        h += '<div class="' + (open ? "open" : "") + '" data-tree="' + s.id + '"><div class="row" style="display:flex">' +
          '<button class="nl" data-toggle="' + s.id + '"><span class="tw">▶</span><span class="ic">' + ic("layers") + '</span><span class="txt">' + esc(s.name) + "</span></button></div>" +
          '<div class="kids"><a href="#/s/' + s.id + '" class="' + (active === s.id ? "on" : "") + '"><span class="ic">' + ic("quiz") + '</span><span class="txt">Vue d\'ensemble</span></a>';
        s.lessons.forEach(function (lid) {
          var st = stats(BYLESSON[lid] || []);
          h += '<a href="#/l/' + lid + '" class="' + (active === lid ? "on" : "") + '" title="' + esc(LESSONS[lid].title) + '"><span class="ic">' + ic("doc") + '</span><span class="txt">' + esc(LESSONS[lid].short || LESSONS[lid].title) + '</span><span class="pct">' + (st.done ? pct(st.frac) : "") + "</span></a>";
        });
        h += "</div></div>";
      });
    });
    h += "</div>";
    h += '<div class="side-foot">Photos : <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a> (licence libre). Progression enregistrée sur cet appareil.</div>';
    $("#sidebar").innerHTML = h;
    $$("[data-toggle]", $("#sidebar")).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-toggle"), el = b.closest("[data-tree]");
        el.classList.toggle("open"); openTree[id] = el.classList.contains("open"); save("rv.tree", openTree);
      });
    });
    $$("a", $("#sidebar")).forEach(function (a) { a.addEventListener("click", closeMenu); });
  }
  function navLink(href, icon, label, on) { return '<a href="' + href + '" class="' + (on ? "on" : "") + '"><span class="ic">' + ic(icon) + '</span><span class="txt">' + label + "</span></a>"; }
  function closeMenu() { $("#sidebar").classList.remove("show"); $("#scrim").classList.remove("show"); }
  $("#menuBtn").addEventListener("click", function () { $("#sidebar").classList.add("show"); $("#scrim").classList.add("show"); });
  $("#scrim").addEventListener("click", closeMenu);
  $("#searchBtn").addEventListener("click", function () { go("#/recherche"); });

  function crumbs(list) {
    $("#crumbs").innerHTML = list.map(function (c, i) {
      return (i ? '<span class="sep">/</span>' : "") + (c[1] && i < list.length - 1 ? '<a href="' + c[1] + '">' + esc(c[0]) + "</a>" : '<span class="cur">' + esc(c[0]) + "</span>");
    }).join("");
  }
  function cover(img) { return '<div class="cover" style="background-image:url(assets/covers/' + img + '.jpg)"></div>'; }

  /* ------------------------------------------------------------ routeur */
  var session = null;
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  window.addEventListener("hashchange", route);
  function route() {
    stopTimer(); closeMenu();
    var h = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    var r = h[0];
    window.scrollTo(0, 0);
    if (r === "a" && appOf(h[1])) return pageApp(h[1]);
    if (r === "s" && sepiOf(h[1])) return pageSepi(h[1]);
    if (r === "l" && LESSONS[h[1]]) return pageLesson(h[1], h[2] || "fiche", h[3]);
    if (r === "quiz" && session) return renderQuiz();
    if (r === "resultats" && session) return renderResults();
    if (r === "recherche") return pageSearch(h[1] || "");
    if (r === "erreurs") return pageErrors();
    if (r === "stats") return pageStats();
    return pageHome();
  }

  /* ------------------------------------------------------------ accueil */
  function pageHome() {
    sidebar("home"); crumbs([["RevyzMed"]]);
    var all = stats(D.order), nLess = Object.keys(LESSONS).length;
    var lastL = load("rv.lastLesson", null);
    var h = cover("home") + '<div class="page wide fade"><div class="picon">' + ic("quiz") + "</div>";
    h += '<h1 class="ptitle">RevyzMed</h1><p class="psub">Tes leçons remises au propre, et toutes les questions pour les maîtriser.</p>';
    h += '<div class="tiles"><div class="tile"><b>' + nLess + '</b><span>leçons</span></div><div class="tile"><b>' + D.order.length + '</b><span>questions</span></div>' +
      '<div class="tile"><b>' + all.done + '</b><span>déjà faites</span></div><div class="tile"><b>' + (all.done ? pct(all.avg) : "—") + '</b><span>réussite moyenne</span></div></div>';
    if (lastL && LESSONS[lastL]) {
      h += '<div class="callout acc"><span class="ci">' + "↻" + '</span><div style="flex:1">Reprendre là où tu t\'es arrêté : <b>' + esc(LESSONS[lastL].title) + '</b></div>' +
        '<a class="btn sm" href="#/l/' + lastL + '/questions">Continuer ' + ic("arrow", "go") + "</a></div>";
    }
    D.apps.forEach(function (a) {
      h += '<h2 class="sec">' + esc(a.name) + "</h2>";
      h += '<div class="gallery">';
      a.sepis.forEach(function (s) {
        var st = stats(qidsOfScope(s.id));
        h += '<a class="gcard" href="#/s/' + s.id + '"><div class="gimgw"><div class="gimg" style="background-image:url(assets/covers/' + s.cover + '.jpg)"></div></div>' +
          '<div class="gbody"><div class="gt">' + esc(s.name) + ' <span class="tag gray">' + esc(a.short) + "</span></div>" +
          '<div class="gm">' + plural(s.lessons.length, "leçon") + " · " + st.n + " questions</div>" +
          '<div class="gm" style="font-size:12.5px">' + s.lessons.map(function (l) { return esc(LESSONS[l].short || LESSONS[l].title); }).join(" · ") + "</div>" +
          '<div class="prog"><i style="width:' + pct(st.frac) + '"></i></div></div></a>';
      });
      h += "</div>";
    });
    h += '<h2 class="sec">Révision</h2><div class="btns">' +
      '<button class="btn" id="testAll">' + ic("shuffle") + "Test aléatoire sur tout (" + S.n + ")</button>" +
      '<a class="btn" href="#/erreurs">' + ic("redo") + "Revoir mes erreurs</a>" +
      '<a class="btn" href="#/stats">' + ic("chart") + "Statistiques</a></div>";
    h += "</div>";
    app.innerHTML = h;
    $("#testAll").addEventListener("click", function () { startTest("all"); });
  }

  /* ------------------------------------------------------------ appareil / SEPI */
  function pageApp(id) {
    var a = appOf(id);
    if (a.sepis.length) return go("#/s/" + a.sepis[0].id);
  }
  function lessonRows(ids) {
    var h = '<div class="dbhead"><span>Leçon</span><span class="hide">Questions</span><span class="hide">Progression</span><span></span></div><div class="db">';
    ids.forEach(function (lid) {
      var L = LESSONS[lid], st = stats(BYLESSON[lid] || []);
      h += '<a class="dbrow" href="#/l/' + lid + '"><span class="t">' + ic("doc") + "<span>" + esc(L.title) + "</span></span>" +
        '<span class="m hide">' + st.n + ' questions</span><span class="m hide"><div class="prog"><i style="width:' + pct(st.frac) + '"></i></div></span>' +
        '<span class="m">' + (st.done ? pct(st.avg) + " réussite" : "à commencer") + "</span></a>";
    });
    return h + "</div>";
  }
  function pageSepi(id) {
    var s = sepiOf(id), a = appOf(s.app), ids = qidsOfScope(id), st = stats(ids);
    sidebar(id); crumbs([["RevyzMed", "#/"], [a.name, "#/s/" + id], [s.name]]);
    var h = cover(s.cover) + '<div class="page fade"><div class="picon">' + ic(a.icon) + "</div>";
    h += '<h1 class="ptitle">' + esc(a.name) + " — " + esc(s.name) + '</h1><p class="psub">' + plural(s.lessons.length, "leçon") + " · " + ids.length + " questions</p>";
    h += '<div class="tiles"><div class="tile"><b>' + st.done + "/" + st.n + '</b><span>questions faites</span></div><div class="tile"><b>' + (st.done ? pct(st.avg) : "—") +
      '</b><span>réussite</span></div><div class="tile"><b>' + st.err + "</b><span>à revoir</span></div></div>";
    h += '<div class="btns" style="margin:14px 0 6px"><button class="btn pri" id="tst">' + ic("shuffle") + "Test " + S.n + " questions sur le " + esc(s.name) + "</button>" +
      '<button class="btn" id="allq">' + ic("play") + "Tout le " + esc(s.name) + " à la suite</button>" +
      (st.err ? '<button class="btn" id="err">' + ic("redo") + "Mes erreurs (" + st.err + ")</button>" : "") + "</div>";
    h += '<h2 class="sec">Leçons</h2>' + lessonRows(s.lessons) + "</div>";
    app.innerHTML = h;
    $("#tst").addEventListener("click", function () { startTest(id); });
    $("#allq").addEventListener("click", function () { startPractice(id, 0); });
    var e = $("#err"); if (e) e.addEventListener("click", function () { startErrors(id); });
  }

  /* ------------------------------------------------------------ leçon : fiche + questions */
  function pageLesson(lid, tab, arg) {
    var L = LESSONS[lid], s = sepiOf(L.sepi), a = appOf(L.app), ids = BYLESSON[lid] || [], st = stats(ids);
    save("rv.lastLesson", lid);
    sidebar(lid); crumbs([["RevyzMed", "#/"], [a.name + " · " + s.name, "#/s/" + s.id], [L.short || L.title]]);
    var h = cover(L.cover || s.cover) + '<div class="page' + (tab === "fiche" ? " wide" : "") + ' fade"><div class="picon">' + ic(a.icon) + "</div>";
    h += '<h1 class="ptitle">' + esc(L.title) + '</h1><p class="psub">' + esc(a.name) + " · " + esc(s.name) + " · " + ids.length + " questions" +
      (st.done ? " · " + pct(st.frac) + " faites, " + pct(st.avg) + " de réussite" : "") + "</p>";
    h += '<div class="tabs"><a href="#/l/' + lid + '/fiche" class="' + (tab === "fiche" ? "on" : "") + '">Fiche de cours</a><a href="#/l/' + lid + '/questions" class="' + (tab !== "fiche" ? "on" : "") + '">Questions (' + ids.length + ")</a></div>";
    if (tab === "fiche") {
      h += '<div class="fiche-wrap"><article class="fiche" id="fiche">' + L.fiche + '</article><nav class="toc" id="toc"></nav></div>';
      h += '<div class="btns" style="margin-top:30px"><a class="btn pri" href="#/l/' + lid + '/questions">' + ic("quiz") + "S'entraîner sur cette leçon " + ic("arrow", "go") + "</a></div>";
    } else {
      var last = LAST[lid] || 0;
      h += '<div class="btns"><button class="btn pri" id="start">' + ic("play") + (last ? "Reprendre (question " + (last + 1) + ")" : "Commencer") + "</button>" +
        (last ? '<button class="btn" id="restart">Recommencer du début</button>' : "") +
        '<button class="btn" id="tst">' + ic("shuffle") + "Test " + Math.min(S.n, ids.length) + " questions</button>" +
        (st.err ? '<button class="btn" id="err">' + ic("redo") + "Mes erreurs (" + st.err + ")</button>" : "") + "</div>";
      h += '<div class="gridhead"><span>Aller directement à une question</span><span>' + st.done + " / " + ids.length + "</span></div>";
      h += '<div class="grid">' + ids.map(function (id, i) {
        var p = P[id]; return '<button class="gd ' + (p ? cls(p.s) : "") + '" data-i="' + i + '" title="' + esc(TYPE_LABEL[Q[id].type]) + " — " + esc(Q[id].section || "") + '">' + (i + 1) + "</button>";
      }).join("") + "</div>";
      h += '<h2 class="sec">Par partie du cours</h2><div class="db">';
      var secs = [];
      ids.forEach(function (id, i) { var sname = (Q[id].section || "").split("›")[0].trim() || "Leçon"; var last = secs[secs.length - 1]; if (!last || last.n !== sname) secs.push({ n: sname, i: i, ids: [id] }); else last.ids.push(id); });
      secs.forEach(function (sc) {
        var st2 = stats(sc.ids);
        h += '<a class="dbrow" href="javascript:void 0" data-i="' + sc.i + '"><span class="t">' + ic("quiz") + "<span>" + esc(sc.n) + '</span></span><span class="m hide">' + sc.ids.length + ' questions</span><span class="m hide"><div class="prog"><i style="width:' + pct(st2.frac) + '"></i></div></span><span class="m">' + (st2.done ? pct(st2.avg) : "—") + "</span></a>";
      });
      h += "</div>";
    }
    h += "</div>";
    app.innerHTML = h;
    if (tab === "fiche") setupFiche(arg);
    else {
      $("#start").addEventListener("click", function () { startPractice(lid, LAST[lid] || 0); });
      var rs = $("#restart"); if (rs) rs.addEventListener("click", function () { startPractice(lid, 0); });
      $("#tst").addEventListener("click", function () { startTest(lid); });
      var e = $("#err"); if (e) e.addEventListener("click", function () { startErrors(lid); });
      $$("[data-i]", app).forEach(function (b) { b.addEventListener("click", function () { startPractice(lid, +b.getAttribute("data-i")); }); });
    }
  }
  function setupFiche(arg) {
    var f = $("#fiche");
    $$(".pg", f).forEach(function (m) { m.setAttribute("data-label", "p. " + m.getAttribute("data-page")); m.id = "pg-" + m.getAttribute("data-page"); });
    var toc = '<b>Sommaire</b>', k = 0;
    $$("h2, h3", f).forEach(function (hh) { hh.id = "s" + (k++); toc += '<a href="javascript:void 0" data-t="' + hh.id + '" class="' + hh.tagName.toLowerCase() + '">' + esc(hh.textContent) + "</a>"; });
    $("#toc").innerHTML = toc;
    $$("[data-t]", $("#toc")).forEach(function (a) { a.addEventListener("click", function () { var t = document.getElementById(a.getAttribute("data-t")); if (t) t.scrollIntoView({ behavior: "smooth" }); }); });
    $$("img", f).forEach(function (im) { im.loading = "lazy"; im.addEventListener("click", function () { zoom(im.src); }); });
    if (arg) {
      var parts = arg.split("~"), pg = parts[0], term = parts[1];
      if (term) highlight(f, term);
      setTimeout(function () {
        var target = term ? $("mark", f) : document.getElementById("pg-" + pg);
        if (pg && !term) target = document.getElementById("pg-" + pg);
        if (term) { var marks = $$("mark", f), pm = document.getElementById("pg-" + pg); target = marks.filter(function (m) { return !pm || (pm.compareDocumentPosition(m) & 4); })[0] || marks[0] || pm; }
        if (target) { target.scrollIntoView({ block: "center" }); if (target.tagName !== "MARK" && target.nextElementSibling) target.nextElementSibling.classList.add("flash"); }
      }, 60);
    }
  }
  function highlight(root, term) {
    var t = norm(term); if (!t) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var v = n.nodeValue, nv = norm(v), i = nv.indexOf(t);
      if (i < 0) return;
      var span = document.createElement("span"), out = "", last = 0;
      while (i >= 0) { out += esc(v.slice(last, i)) + "<mark>" + esc(v.slice(i, i + t.length)) + "</mark>"; last = i + t.length; i = nv.indexOf(t, last); }
      span.innerHTML = out + esc(v.slice(last)); n.parentNode.replaceChild(span, n);
    });
  }
  function zoom(src) { var lb = $("#lightbox"); lb.querySelector("img").src = src; lb.hidden = false; }
  $("#lightbox").addEventListener("click", function () { this.hidden = true; });

  /* ------------------------------------------------------------ sessions */
  var TYPE_LABEL = { qcm: "QCM", qcu: "QCU", order: "Remettre dans l'ordre", categorize: "Classer", match: "Relier", cloze: "Texte à trous", label: "Légender le schéma" };
  var TYPE_HINT = {
    qcm: "Une ou plusieurs réponses justes.", qcu: "Une seule réponse juste.",
    order: "Glisse les éléments (ou utilise les flèches) pour les remettre dans l'ordre.",
    categorize: "Glisse chaque étiquette dans la bonne catégorie (ou touche l'étiquette puis la catégorie).",
    match: "Glisse chaque proposition en face de l'élément correspondant.",
    cloze: "Glisse les mots dans les trous (ou touche le mot puis le trou).",
    label: "Place chaque terme sur le schéma (glisser-déposer, ou toucher le terme puis la case)."
  };
  function newSession(mode, scope, ids, idx) {
    session = { mode: mode, scope: scope, list: ids, idx: idx || 0, st: {}, done: {}, locked: {}, started: Date.now(), finished: false };
    if (mode === "test" && S.timer && S.timerMode === "t") session.deadline = Date.now() + S.timerT * 60000;
    go("#/quiz");
  }
  function startPractice(scope, idx) { var ids = qidsOfScope(scope); if (ids.length) newSession("practice", scope, ids, Math.min(idx || 0, ids.length - 1)); }
  function startTest(scope) { var ids = shuffle(qidsOfScope(scope)).slice(0, S.n); if (ids.length) newSession("test", scope, ids, 0); }
  function startErrors(scope) {
    var ids = qidsOfScope(scope).filter(function (id) { return P[id] && P[id].s < 0.999; });
    if (ids.length) newSession("errors", scope, ids, 0);
  }

  /* état initial d'une question (mélanges) */
  function initState(q) {
    var st = { sel: {}, place: {} };
    if (q.type === "order") {
      var idx = q.items.map(function (_, i) { return i; }), s = shuffle(idx), tries = 0;
      while (s.join() === idx.join() && tries++ < 10) s = shuffle(idx);
      st.order = s;
    }
    if (q.type === "categorize") st.chips = shuffle(q.items.map(function (it) { return it.text; }));
    if (q.type === "match") st.chips = shuffle(q.pairs.map(function (p) { return p[1]; }));
    if (q.type === "cloze") { st.blanks = blanksOf(q.text); st.chips = shuffle(st.blanks.concat(q.distractors || [])); }
    if (q.type === "label") st.chips = shuffle(q.zones.map(function (z) { return z.answer; }).concat(q.distractors || []));
    if (q.type === "qcm" || q.type === "qcu") st.opts = q.options.map(function (_, i) { return i; });
    return st;
  }
  function blanksOf(text) { var r = [], m, re = /\{\{(.+?)\}\}/g; while ((m = re.exec(text))) r.push(m[1]); return r; }

  /* score d'une question */
  function evaluate(q, st) {
    var t = q.type;
    if (t === "qcm") {
      var disc = 0; q.options.forEach(function (o, i) { if (!!o.correct !== !!st.sel[i]) disc++; });
      return { score: disc === 0 ? 1 : disc === 1 ? 0.5 : disc === 2 ? 0.2 : 0 };
    }
    if (t === "qcu") { var ok = q.options.some(function (o, i) { return o.correct && st.sel[i]; }); return { score: ok ? 1 : 0 }; }
    var res = [], n = 0;
    if (t === "order") { st.order.forEach(function (orig, pos) { res.push(orig === pos); }); n = q.items.length; }
    if (t === "categorize") { q.items.forEach(function (it, i) { var ci = st.chips.indexOf(it.text); res.push(st.place[ci] === "c:" + it.cat); }); n = q.items.length; }
    if (t === "match") { q.pairs.forEach(function (p, i) { res.push(chipIn(st, "s:" + i).some(function (ci) { return st.chips[ci] === p[1]; })); }); n = q.pairs.length; }
    if (t === "cloze") { st.blanks.forEach(function (b, i) { res.push(chipIn(st, "s:" + i).some(function (ci) { return norm(st.chips[ci]) === norm(b); })); }); n = st.blanks.length; }
    if (t === "label") { q.zones.forEach(function (z, i) { res.push(chipIn(st, "s:" + i).some(function (ci) { return norm(st.chips[ci]) === norm(z.answer); })); }); n = q.zones.length; }
    var good = res.filter(Boolean).length;
    return { score: n ? good / n : 0, res: res, good: good, n: n };
  }
  function chipIn(st, slot) { var r = []; Object.keys(st.place).forEach(function (ci) { if (st.place[ci] === slot) r.push(+ci); }); return r; }

  /* ------------------------------------------------------------ rendu d'une question */
  function renderQuiz() {
    var Sx = session, qid = Sx.list[Sx.idx], q = Q[qid], L = LESSONS[q.lesson];
    var st = Sx.st[qid] || (Sx.st[qid] = initState(q));
    var test = Sx.mode === "test";
    var corr = test ? (Sx.finished || (S.instant && Sx.done[qid] != null)) : Sx.done[qid] != null;
    var locked = corr || Sx.locked[qid] || (test && Sx.done[qid] != null);
    if (Sx.mode === "practice" && LESSONS[Sx.scope]) { LAST[Sx.scope] = Sx.idx; save("rv.last", LAST); }
    sidebar(q.lesson);
    var mLabel = { practice: "Entraînement", test: "Test", errors: "Revoir mes erreurs" }[Sx.mode];
    crumbs([["RevyzMed", "#/"], [scopeName(Sx.scope), LESSONS[Sx.scope] ? "#/l/" + Sx.scope + "/questions" : sepiOf(Sx.scope) ? "#/s/" + Sx.scope : "#/"], [mLabel]]);
    var spec = timerSpec();
    var h = '<div class="page fade">';
    h += '<div class="qtop"><div class="lbl"><small>' + esc(mLabel) + " · " + esc(scopeName(Sx.scope)) + "</small><b>Question " + (Sx.idx + 1) + " / " + Sx.list.length + "</b></div>" +
      (spec ? '<span class="timer" id="timer">' + ic("clock") + "<span></span></span>" : "") +
      '<button class="btn sm ghost" id="quit">Quitter</button></div>';
    h += '<div class="qprog"><i style="width:' + ((Sx.idx + 1) / Sx.list.length * 100) + '%"></i></div>';
    h += '<article class="qcard"><div class="qmeta"><span class="tag">' + esc(TYPE_LABEL[q.type]) + "</span><span>" + esc(L.short || L.title) + "</span>" +
      (q.section ? "<span>·</span><span>" + esc(q.section) + "</span>" : "") + "</div>";
    h += '<div class="qstem">' + md(q.stem) + "</div>";
    if (!locked) h += '<div class="qhint">' + esc(TYPE_HINT[q.type]) + "</div>";
    if (q.images && q.images.length) h += '<div class="qfigs">' + q.images.map(function (s) { return '<img src="' + esc(s) + '" alt="Figure" loading="lazy">'; }).join("") + "</div>";
    var ev = corr ? evaluate(q, st) : null;
    h += '<div id="qbody" class="qbody">' + bodyHTML(q, st, locked, corr, ev) + "</div>";

    if (corr) {
      var sc = ev.score;
      h += '<div class="res ' + cls(sc) + '"><span class="sc">' + (q.type === "qcm" || q.type === "qcu" ? fmt(sc) + " / 1" : ev.good + " / " + ev.n) + "</span><span>" +
        (sc >= 0.999 ? "Parfait !" : sc >= 0.5 ? "Presque, regarde la correction." : "À revoir : lis bien la correction.") + "</span></div>";
      if (q.type === "qcm" || q.type === "qcu") h += '<div class="legend"><span><i class="lg1"></i>coché et juste</span><span><i class="lg2"></i>coché mais faux</span><span><i class="lg3"></i>juste, oublié</span><span><i class="lg4"></i>faux, non coché</span></div>';
      h += '<div class="corr"><div class="ch">' + ic("doc") + " Correction</div><div class=\"cb\">" + md(q.explanation || "") + excerptHTML(q) + "</div></div>";
    } else if (test && Sx.done[qid] != null) {
      h += '<div class="callout"><span class="ci">✓</span><div>Réponse enregistrée — correction à la fin du test.</div></div>';
    } else if (Sx.locked[qid]) {
      h += '<div class="callout warn"><span class="ci">⏱</span><div>Temps écoulé pour cette question.</div></div>';
    }

    var last = Sx.idx === Sx.list.length - 1;
    h += '<div class="qnav"><button class="btn ghost" id="prev"' + (Sx.idx === 0 ? " disabled" : "") + ">←<span class=\"hm\"> Précédente</span></button><div class=\"mid\">";
    if (!test) h += Sx.done[qid] != null ? '<button class="btn" id="retry">Refaire</button>' : '<button class="btn pri lg" id="val">Valider</button>';
    else if (!Sx.finished) {
      if (Sx.done[qid] == null && !Sx.locked[qid]) h += '<button class="btn pri lg" id="val">Valider</button>';
      if (last || Object.keys(Sx.done).length === Sx.list.length) h += '<button class="btn" id="finish">Terminer le test</button>';
    } else h += '<button class="btn" id="resBtn">Résultats</button>';
    h += '</div><button class="btn ghost" id="next"' + (last ? " disabled" : "") + "><span class=\"hm\">Suivante </span>→</button></div></article>";

    h += '<div class="gridhead"><span>Questions</span><span>' + Object.keys(Sx.done).length + " validée(s)</span></div><div class=\"grid\">";
    Sx.list.forEach(function (id, i) {
      var c = "gd" + (i === Sx.idx ? " cur" : ""), shown = test ? (Sx.finished || S.instant) : true;
      if (Sx.done[id] != null) c += shown ? " " + cls(Sx.done[id]) : " ans";
      h += '<button class="' + c + '" data-g="' + i + '">' + (i + 1) + "</button>";
    });
    h += '</div><p class="kbd"><kbd>A</kbd>–<kbd>E</kbd> cocher · <kbd>Entrée</kbd> valider · <kbd>←</kbd> <kbd>→</kbd> naviguer</p></div>';
    app.innerHTML = h;
    bindQuestion(q, st, locked);
    on("#prev", function () { Sx.idx--; renderQuiz(); });
    on("#next", function () { Sx.idx++; renderQuiz(); });
    on("#val", validate);
    on("#retry", function () { delete Sx.done[qid]; Sx.st[qid] = initState(q); if (Sx.qEnd) delete Sx.qEnd[qid]; renderQuiz(); });
    on("#finish", function () {
      var left = Sx.list.length - Object.keys(Sx.done).length, b = $("#finish");
      if (left > 0 && !b.dataset.armed) { b.dataset.armed = 1; b.textContent = left + " sans réponse — confirmer ?"; return; }
      finish();
    });
    on("#resBtn", function () { go("#/resultats"); });
    on("#quit", function () { var sc = Sx.scope; session = null; go(LESSONS[sc] ? "#/l/" + sc + "/questions" : sepiOf(sc) ? "#/s/" + sc : "#/"); });
    $$("[data-g]", app).forEach(function (b) { b.addEventListener("click", function () { Sx.idx = +b.getAttribute("data-g"); renderQuiz(); }); });
    $$(".qfigs img, .corr img.full", app).forEach(function (im) { im.addEventListener("click", function () { zoom(im.src); }); });
    $$("[data-full]", app).forEach(function (b) { b.addEventListener("click", function () { zoom(b.getAttribute("data-full")); }); });
    if (spec) runTimer(spec);
  }
  function on(sel, fn) { var e = $(sel); if (e) e.addEventListener("click", fn); }

  var CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function bodyHTML(q, st, locked, corr, ev) {
    var t = q.type, h = "";
    if (t === "qcm" || t === "qcu") {
      h += '<div class="opts' + (locked ? " done" : "") + '">';
      q.options.forEach(function (o, i) {
        var c = "opt" + (st.sel[i] ? " sel" : ""), vd = "";
        if (corr) {
          if (o.correct && st.sel[i]) { c += " okSel"; vd = "Juste"; }
          else if (!o.correct && st.sel[i]) { c += " koSel"; vd = "Faux · coché"; }
          else if (o.correct) { c += " okMiss"; vd = "Juste · oublié"; }
          else { c += " koOk"; vd = "Faux"; }
        }
        h += '<button class="' + c + '" data-o="' + i + '"><span class="box' + (t === "qcu" ? " round" : "") + '">' + CHECK + '</span><span class="lt">' + "ABCDEFGH"[i] +
          '</span><span class="tx">' + inl(o.text) + "</span>" + (vd ? '<span class="vd">' + vd + "</span>" : "") + "</button>";
        if (corr && o.justif) h += '<div class="justif">' + inl(o.justif) + "</div>";
      });
      return h + "</div>";
    }
    if (t === "order") {
      h += '<div class="olist" id="olist">';
      st.order.forEach(function (orig, pos) {
        var c = "oitem";
        if (corr) c += ev.res[pos] ? " ok" : " ko";
        h += '<div class="' + c + '" data-pos="' + pos + '">' + (locked ? "" : '<span class="grip">' + '<svg viewBox="0 0 24 24">' + IC.grip + "</svg></span>") +
          '<span class="n">' + (pos + 1) + '</span><span class="tx">' + inl(q.items[orig]) + "</span>" +
          (corr && !ev.res[pos] ? '<span class="fix">→ position ' + (orig + 1) + "</span>" : "") +
          (locked ? "" : '<span class="mv"><button data-up="' + pos + '" aria-label="Monter">▲</button><button data-dn="' + pos + '" aria-label="Descendre">▼</button></span>') + "</div>";
      });
      h += "</div>";
      if (corr && ev.score < 0.999) h += '<div class="callout" style="margin-top:12px"><span class="ci">✓</span><div><b>Ordre correct :</b><ol style="margin:4px 0 0;padding-left:20px">' + q.items.map(function (x) { return "<li>" + inl(x) + "</li>"; }).join("") + "</ol></div></div>";
      return h;
    }
    // types à étiquettes
    var pool = st.chips.map(function (txt, ci) { return st.place[ci] == null ? chipHTML(ci, txt, locked) : ""; }).join("");
    if (!locked || pool) h += '<div class="pool slot" data-slot="pool">' + pool + "</div>";
    if (t === "categorize") {
      h += '<div class="cats">';
      q.categories.forEach(function (c) {
        h += '<div class="cat"><h5>' + inl(c) + '</h5><div class="in slot" data-slot="c:' + esc(c) + '">' +
          chipIn(st, "c:" + c).map(function (ci) {
            var cc = ""; if (corr) { var it = q.items.filter(function (x) { return x.text === st.chips[ci]; })[0]; cc = it && it.cat === c ? "ok" : "ko"; }
            var fix = corr && cc === "ko" ? ' <span class="fix" style="color:var(--ok)">→ ' + esc(q.items.filter(function (x) { return x.text === st.chips[ci]; })[0].cat) + "</span>" : "";
            return chipHTML(ci, st.chips[ci], locked, cc, fix);
          }).join("") + "</div></div>";
      });
      h += "</div>";
      if (corr) { var miss = q.items.filter(function (it) { return st.place[st.chips.indexOf(it.text)] == null; }); if (miss.length) h += '<div class="callout warn" style="margin-top:10px"><span class="ci">!</span><div>Non placés : ' + miss.map(function (m) { return "<b>" + esc(m.text) + "</b> → " + esc(m.cat); }).join(" ; ") + "</div></div>"; }
      return h;
    }
    if (t === "match") {
      h += '<div class="pairs">';
      q.pairs.forEach(function (p, i) {
        var inside = chipIn(st, "s:" + i).map(function (ci) { return chipHTML(ci, st.chips[ci], locked, corr ? (ev.res[i] ? "ok" : "ko") : ""); }).join("");
        h += '<div class="pair"><div class="l">' + inl(p[0]) + '</div><div class="ar">→</div><div><div class="slot" data-slot="s:' + i + '" data-cap="1">' + inside + "</div>" +
          (corr && !ev.res[i] ? '<div style="font-size:12.5px;color:var(--ok);margin:3px 2px 0;font-weight:600">✓ ' + inl(p[1]) + "</div>" : "") + "</div></div>";
      });
      return h + "</div>";
    }
    if (t === "cloze") {
      var bi = 0;
      var txt = esc(q.text).replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>").replace(/\{\{(.+?)\}\}/g, function (m, ans) {
        var i = bi++, inside = chipIn(st, "s:" + i).map(function (ci) { return chipHTML(ci, st.chips[ci], locked, corr ? (ev.res[i] ? "ok" : "ko") : ""); }).join("");
        return '<span class="blank slot" data-slot="s:' + i + '" data-cap="1">' + inside + "</span>" + (corr && !ev.res[i] ? ' <span style="color:var(--ok);font-weight:650;font-size:13px">(' + esc(ans) + ")</span>" : "");
      });
      return h + '<div class="cloze">' + txt.replace(/\n/g, "<br>") + "</div>";
    }
    if (t === "label") {
      h += '<div class="labelwrap"><img src="' + esc(q.image) + '" alt="Schéma à légender" draggable="false">';
      q.zones.forEach(function (z, i) {
        var inside = chipIn(st, "s:" + i).map(function (ci) { return chipHTML(ci, st.chips[ci], locked); }).join("");
        h += '<div class="zone slot' + (corr ? (ev.res[i] ? " ok" : " ko") : "") + '" data-slot="s:' + i + '" data-cap="1" style="left:' + z.x + "%;top:" + z.y + '%">' +
          (inside || '<span class="zn">' + (i + 1) + "</span>") + (corr && !ev.res[i] ? '<span class="zfix">' + esc(z.answer) + "</span>" : "") + "</div>";
      });
      h += "</div>";
      if (corr && q.solution) h += '<div style="margin-top:6px"><button class="btn sm" data-full="' + esc(q.solution) + '">Voir le schéma original légendé</button></div>';
      return h;
    }
    return h;
  }
  function chipHTML(ci, txt, locked, c, extra) { return '<span class="chip' + (c ? " " + c : "") + '" data-chip="' + ci + '"' + (locked ? ' style="cursor:default"' : "") + ">" + inl(txt) + (extra || "") + "</span>"; }

  /* extrait de la leçon (capture de la zone justifiant la réponse) */
  function excerptHTML(q) {
    var r = q.ref; if (!r || !D.pages[r.doc]) return "";
    var pg = D.pages[r.doc], W = pg.w, H = pg.h;
    var x0 = Math.max(0, (r.x0 != null ? r.x0 : 28) - 6), x1 = Math.min(W, (r.x1 != null ? r.x1 : W - 28) + 6);
    var y0 = Math.max(0, r.y0 - 8), y1 = Math.min(H, r.y1 + 10);
    if (y1 - y0 < 24) y1 = Math.min(H, y0 + 40);
    var cw = x1 - x0, chh = y1 - y0, src = "lessons/" + q.lesson + "/pages/" + r.doc + "-p" + r.page + ".jpg";
    var L = LESSONS[q.lesson];
    return '<div class="excerpt"><div class="crop" style="aspect-ratio:' + cw + " / " + chh + '"><img src="' + src + '" alt="Extrait du cours" loading="lazy" style="width:' + (W / cw * 100) + "%;left:" + (-x0 / cw * 100) + "%;top:" + (-y0 / chh * 100) + '%"></div>' +
      '<div class="cap"><span>Extrait du cours — ' + esc(L.short || L.title) + ", page " + r.page + '</span><span style="display:flex;gap:12px"><button data-full="' + src + '">Page entière</button><a href="#/l/' + q.lesson + "/fiche/" + r.page + '">Ouvrir la fiche</a></span></div></div>';
  }

  /* ------------------------------------------------------------ interactions */
  function bindQuestion(q, st, locked) {
    if (locked) return;
    var t = q.type, body = $("#qbody");
    if (t === "qcm" || t === "qcu") {
      $$(".opt", body).forEach(function (b) { b.addEventListener("click", function () { toggleOpt(q, st, +b.getAttribute("data-o")); }); });
      return;
    }
    if (t === "order") { bindOrder(q, st); return; }
    bindChips(q, st);
  }
  function toggleOpt(q, st, i) {
    if (q.type === "qcu") { var was = st.sel[i]; st.sel = {}; if (!was) st.sel[i] = true; }
    else { if (st.sel[i]) delete st.sel[i]; else st.sel[i] = true; }
    $$(".opt", $("#qbody")).forEach(function (b) { b.classList.toggle("sel", !!st.sel[+b.getAttribute("data-o")]); });
  }
  function rerenderBody(q, st) { $("#qbody").innerHTML = bodyHTML(q, st, false, false); bindQuestion(q, st, false); }

  /* glisser-déposer générique + mode « toucher puis toucher » */
  var picked = null;
  function bindChips(q, st) {
    var body = $("#qbody");
    $$(".chip", body).forEach(function (ch) {
      ch.addEventListener("pointerdown", function (e) { startDrag(e, ch, q, st); });
    });
    $$(".slot", body).forEach(function (sl) {
      sl.addEventListener("click", function (e) {
        if (e.target.closest(".chip")) return;
        if (picked != null) { place(q, st, picked, sl.getAttribute("data-slot")); picked = null; }
      });
    });
  }
  function place(q, st, ci, slot) {
    ci = +ci;
    if (slot === "pool") delete st.place[ci];
    else {
      var cap = (slot.indexOf("s:") === 0) ? 1 : 0;
      if (cap) chipIn(st, slot).forEach(function (o) { if (o !== ci) delete st.place[o]; });
      st.place[ci] = slot;
    }
    rerenderBody(q, st);
  }
  function startDrag(e, ch, q, st) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    var ci = +ch.getAttribute("data-chip"), sx = e.clientX, sy = e.clientY, ghost = null, over = null, moved = false;
    function mv(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      if (!moved) {
        moved = true; ghost = ch.cloneNode(true); ghost.classList.add("ghost"); ghost.classList.remove("pick"); document.body.appendChild(ghost); ch.classList.add("dragging");
        $$(".slot", $("#qbody")).forEach(function (s) { s.classList.add("armed"); });
      }
      ghost.style.left = (ev.clientX - ghost.offsetWidth / 2) + "px"; ghost.style.top = (ev.clientY - ghost.offsetHeight / 2) + "px";
      var el = document.elementFromPoint(ev.clientX, ev.clientY), sl = el && el.closest(".slot");
      if (over !== sl) { if (over) over.classList.remove("over"); over = sl; if (over) over.classList.add("over"); }
      if (ev.clientY < 60) window.scrollBy(0, -12); else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    }
    function up() {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      if (ghost) ghost.remove();
      $$(".slot", $("#qbody")).forEach(function (s) { s.classList.remove("armed", "over"); });
      if (moved) { picked = null; if (over) place(q, st, ci, over.getAttribute("data-slot")); else rerenderBody(q, st); return; }
      // tap : sélectionner / renvoyer dans la réserve
      if (st.place[ci] != null) { place(q, st, ci, "pool"); return; }
      picked = picked === ci ? null : ci;
      $$(".chip", $("#qbody")).forEach(function (c) { c.classList.toggle("pick", +c.getAttribute("data-chip") === picked); });
      $$(".slot", $("#qbody")).forEach(function (s) { s.classList.toggle("armed", picked != null && s.getAttribute("data-slot") !== "pool"); });
    }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  }

  /* remise en ordre */
  function bindOrder(q, st) {
    var list = $("#olist");
    $$("[data-up]", list).forEach(function (b) { b.addEventListener("click", function () { var p = +b.getAttribute("data-up"); if (p > 0) { swap(st.order, p, p - 1); rerenderBody(q, st); } }); });
    $$("[data-dn]", list).forEach(function (b) { b.addEventListener("click", function () { var p = +b.getAttribute("data-dn"); if (p < st.order.length - 1) { swap(st.order, p, p + 1); rerenderBody(q, st); } }); });
    $$(".oitem", list).forEach(function (it) {
      it.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        var from = +it.getAttribute("data-pos"), sy = e.clientY, items = $$(".oitem", list), rects = items.map(function (x) { return x.getBoundingClientRect(); }), to = from, moved = false;
        function mv(ev) {
          var dy = ev.clientY - sy; if (!moved && Math.abs(dy) < 5) return; moved = true;
          it.classList.add("lift"); it.style.transform = "translateY(" + dy + "px)";
          var cy = rects[from].top + rects[from].height / 2 + dy; to = from;
          rects.forEach(function (r, i) { if (i < from && cy < r.top + r.height / 2) to = Math.min(to, i); if (i > from && cy > r.top + r.height / 2) to = Math.max(to, i); });
          items.forEach(function (x, i) {
            if (x === it) return; var sh = 0, hgt = rects[from].height + 8;
            if (from < to && i > from && i <= to) sh = -hgt; if (from > to && i < from && i >= to) sh = hgt;
            x.style.transform = sh ? "translateY(" + sh + "px)" : "";
          });
        }
        function up() {
          document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
          if (moved && to !== from) { var v = st.order.splice(from, 1)[0]; st.order.splice(to, 0, v); }
          rerenderBody(q, st);
        }
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
      });
    });
  }
  function swap(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }

  /* ------------------------------------------------------------ validation */
  function validate() {
    var Sx = session, qid = Sx.list[Sx.idx], q = Q[qid];
    if (Sx.done[qid] != null) return;
    var sc = evaluate(q, Sx.st[qid]).score;
    Sx.done[qid] = sc; stopTimer();
    var p = P[qid] || { a: 0, b: 0 }; p.s = sc; p.a = (p.a || 0) + 1; p.b = Math.max(p.b || 0, sc); p.t = Date.now(); P[qid] = p; save("rv.progress", P);
    if (Sx.mode === "test" && !S.instant && Sx.idx < Sx.list.length - 1) { Sx.idx++; }
    renderQuiz();
    if (!(Sx.mode === "test" && !S.instant)) { var r = $(".res"); if (r) r.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }
  function finish() {
    var Sx = session; stopTimer();
    Sx.list.forEach(function (id) {
      if (Sx.done[id] == null) { var st = Sx.st[id] || (Sx.st[id] = initState(Q[id])); Sx.done[id] = evaluate(Q[id], st).score; var p = P[id] || { a: 0, b: 0 }; p.s = Sx.done[id]; p.a = (p.a || 0) + 1; p.t = Date.now(); P[id] = p; }
    });
    save("rv.progress", P); Sx.finished = true; Sx.ended = Date.now(); go("#/resultats");
  }
  function renderResults() {
    var Sx = session, tot = 0; Sx.list.forEach(function (id) { tot += Sx.done[id] || 0; });
    var n = Sx.list.length, pc = n ? tot / n : 0, dur = Math.round(((Sx.ended || Date.now()) - Sx.started) / 1000);
    sidebar(""); crumbs([["RevyzMed", "#/"], [scopeName(Sx.scope)], ["Résultats"]]);
    var h = '<div class="page fade"><h1 class="ptitle">' + (pc >= 0.8 ? "Excellent !" : pc >= 0.5 ? "Bien joué" : "Continue, ça vient") + "</h1>" +
      '<p class="psub">' + esc(scopeName(Sx.scope)) + " · " + Math.floor(dur / 60) + " min " + (dur % 60) + " s</p>" +
      '<div class="tiles"><div class="tile"><b>' + fmt(tot) + " / " + n + '</b><span>score</span></div><div class="tile"><b>' + pct(pc) + '</b><span>réussite</span></div>' +
      '<div class="tile"><b>' + Sx.list.filter(function (id) { return Sx.done[id] < 0.999; }).length + "</b><span>à revoir</span></div></div>" +
      '<p class="muted" style="font-size:12.5px;color:var(--muted)">Barème : QCM 1 point (1 discordance 0,5 · 2 discordances 0,2) ; exercices à étiquettes : part des éléments bien placés.</p>' +
      '<div class="btns" style="margin:12px 0 4px"><button class="btn pri" id="again">' + ic("shuffle") + "Nouveau test</button><button class=\"btn\" id=\"review\">Revoir la correction</button><a class=\"btn ghost\" href=\"#/\">Accueil</a></div>";
    h += '<div class="rlist">' + Sx.list.map(function (id, i) {
      var q = Q[id], s = Sx.done[id] || 0;
      return '<button class="ritem ' + cls(s) + '" data-i="' + i + '"><span class="p">' + pct(s) + '</span><span class="t"><b>' + (i + 1) + ".</b> " + esc(q.stem.replace(/\*\*/g, "")) + '</span><span class="tag gray">' + esc(TYPE_LABEL[q.type]) + "</span></button>";
    }).join("") + "</div></div>";
    app.innerHTML = h;
    on("#again", function () { startTest(Sx.scope); });
    on("#review", function () { Sx.idx = 0; go("#/quiz"); });
    $$(".ritem", app).forEach(function (b) { b.addEventListener("click", function () { Sx.idx = +b.getAttribute("data-i"); go("#/quiz"); }); });
  }

  /* ------------------------------------------------------------ chronomètre */
  var tick = null;
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
  function timerSpec() {
    var Sx = session; if (!S.timer || !Sx || Sx.finished) return null;
    if (Sx.mode === "test" && S.timerMode === "t") return { end: Sx.deadline, total: S.timerT * 60 };
    if (Sx.mode !== "test" && !S.timerBank) return null;
    var qid = Sx.list[Sx.idx]; if (Sx.done[qid] != null || Sx.locked[qid]) return null;
    Sx.qEnd = Sx.qEnd || {}; if (!Sx.qEnd[qid]) Sx.qEnd[qid] = Date.now() + S.timerQ * 1000;
    return { end: Sx.qEnd[qid], total: S.timerQ, perQ: qid };
  }
  function runTimer(spec) {
    stopTimer(); var el = $("#timer"); if (!el) return;
    function upd() {
      var left = Math.max(0, Math.round((spec.end - Date.now()) / 1000));
      el.querySelector("span").textContent = Math.floor(left / 60) + ":" + ("0" + left % 60).slice(-2);
      el.classList.toggle("low", left <= Math.min(10, spec.total * 0.15));
      if (left <= 0) {
        stopTimer();
        if (!spec.perQ) return finish();
        if (session.mode === "test" && !S.instant) { session.locked[spec.perQ] = true; if (session.idx < session.list.length - 1) session.idx++; renderQuiz(); }
        else validate();
      }
    }
    upd(); tick = setInterval(upd, 1000);
  }

  /* ------------------------------------------------------------ clavier */
  document.addEventListener("keydown", function (e) {
    if (!$("#settings").hidden || !$("#lightbox").hidden) { if (e.key === "Escape") { $("#settings").hidden = true; $("#lightbox").hidden = true; } return; }
    if (!session || !$("#qbody") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    var q = Q[session.list[session.idx]], st = session.st[q.id];
    var k = e.key.toUpperCase();
    if ((q.type === "qcm" || q.type === "qcu") && /^[A-H]$/.test(k) && $(".opt", $("#qbody")) && !$(".opts.done")) { var i = k.charCodeAt(0) - 65; if (i < q.options.length) { e.preventDefault(); toggleOpt(q, st, i); } }
    else if (e.key === "Enter") { var v = $("#val"); if (v) { e.preventDefault(); v.click(); } }
    else if (e.key === "ArrowRight") { var n = $("#next"); if (n && !n.disabled) n.click(); }
    else if (e.key === "ArrowLeft") { var p = $("#prev"); if (p && !p.disabled) p.click(); }
  });

  /* ------------------------------------------------------------ erreurs */
  function pageErrors() {
    sidebar("errors"); crumbs([["RevyzMed", "#/"], ["Revoir mes erreurs"]]);
    var h = cover("labo") + '<div class="page fade"><div class="picon">' + ic("redo") + '</div><h1 class="ptitle">Revoir mes erreurs</h1>' +
      '<p class="psub">Les questions dont ta dernière réponse n\'était pas parfaite. Une question réussie sort de la liste.</p>';
    var all = stats(D.order);
    if (!all.err) h += '<div class="callout acc"><span class="ci">✓</span><div>Aucune erreur à revoir pour l\'instant. Lance un entraînement ou un test !</div></div>';
    else {
      h += '<div class="btns" style="margin-bottom:10px"><button class="btn pri" data-err="all">' + ic("redo") + "Tout revoir (" + all.err + ")</button></div>";
      D.apps.forEach(function (a) {
        h += '<h2 class="sec">' + esc(a.name) + '</h2><div class="db">';
        a.sepis.forEach(function (s) {
          s.lessons.forEach(function (lid) {
            var st = stats(BYLESSON[lid] || []); if (!st.err) return;
            h += '<a class="dbrow" href="javascript:void 0" data-err="' + lid + '"><span class="t">' + ic("doc") + "<span>" + esc(LESSONS[lid].title) + '</span></span><span class="m hide">' + esc(s.name) + '</span><span class="m hide"></span><span class="m"><span class="tag ko">' + plural(st.err, "erreur") + "</span></span></a>";
          });
        });
        h += "</div>";
      });
    }
    app.innerHTML = h + "</div>";
    $$("[data-err]", app).forEach(function (b) { b.addEventListener("click", function () { startErrors(b.getAttribute("data-err")); }); });
  }

  /* ------------------------------------------------------------ statistiques */
  function pageStats() {
    sidebar("stats"); crumbs([["RevyzMed", "#/"], ["Statistiques"]]);
    var all = stats(D.order);
    var h = cover("microscope") + '<div class="page fade"><div class="picon">' + ic("chart") + '</div><h1 class="ptitle">Statistiques</h1><p class="psub">Ta progression par appareil, SEPI et leçon.</p>' +
      '<div class="tiles"><div class="tile"><b>' + all.done + " / " + all.n + '</b><span>questions faites</span></div><div class="tile"><b>' + (all.done ? pct(all.avg) : "—") + '</b><span>réussite moyenne</span></div><div class="tile"><b>' + all.err + "</b><span>à revoir</span></div></div>";
    D.apps.forEach(function (a) {
      var sa = stats(qidsOfScope(a.id));
      h += '<h2 class="sec">' + esc(a.name) + " — " + (sa.done ? pct(sa.avg) + " de réussite" : "pas commencé") + "</h2>";
      a.sepis.forEach(function (s) {
        var ss = stats(qidsOfScope(s.id));
        h += '<div style="margin:14px 0 6px;font-weight:650">' + esc(s.name) + ' <span class="tag gray">' + ss.done + "/" + ss.n + " · " + (ss.done ? pct(ss.avg) : "—") + "</span></div>";
        h += '<div class="dbhead"><span>Leçon</span><span class="hide">Faites</span><span class="hide">Réussite</span><span>À revoir</span></div><div class="db">';
        s.lessons.forEach(function (lid) {
          var st = stats(BYLESSON[lid] || []);
          h += '<a class="dbrow" href="#/l/' + lid + '/questions"><span class="t">' + ic("doc") + "<span>" + esc(LESSONS[lid].title) + '</span></span><span class="m hide">' + st.done + " / " + st.n +
            '</span><span class="m hide"><div class="prog"><i style="width:' + (st.done ? pct(st.avg) : "0%") + ';background:' + (st.avg >= .8 ? "var(--ok)" : st.avg >= .5 ? "var(--warn)" : "var(--ko)") + '"></i></div></span><span class="m">' + (st.err ? '<span class="tag ko">' + st.err + "</span>" : "—") + "</span></a>";
        });
        h += "</div>";
      });
    });
    app.innerHTML = h + "</div>";
  }

  /* ------------------------------------------------------------ recherche */
  var SIDX = null;
  function buildIndex() {
    SIDX = [];
    Object.keys(LESSONS).forEach(function (lid) {
      var div = document.createElement("div"); div.innerHTML = LESSONS[lid].fiche;
      var page = 1, buf = "";
      function flush() { if (buf.trim()) SIDX.push({ k: "f", lid: lid, page: page, text: buf.replace(/\s+/g, " ").trim() }); buf = ""; }
      (function walk(n) {
        n.childNodes.forEach(function (c) {
          if (c.nodeType === 1 && c.classList.contains("pg")) { flush(); page = +c.getAttribute("data-page"); return; }
          if (c.nodeType === 3) buf += c.nodeValue + " "; else if (c.nodeType === 1) { walk(c); if (/^(P|LI|TD|TH|H\d|TR)$/.test(c.tagName)) buf += " \n"; }
        });
      })(div);
      flush();
    });
    D.order.forEach(function (id, i) {
      var q = Q[id], parts = [q.stem, q.explanation];
      (q.options || []).forEach(function (o) { parts.push(o.text); });
      (q.items || []).forEach(function (o) { parts.push(o.text || o); });
      (q.pairs || []).forEach(function (p) { parts.push(p[0] + " " + p[1]); });
      if (q.text) parts.push(q.text.replace(/[{}]/g, ""));
      (q.zones || []).forEach(function (z) { parts.push(z.answer); });
      SIDX.push({ k: "q", id: id, text: parts.join(" · ").replace(/\*\*/g, "") });
    });
    SIDX.forEach(function (r) { r.n = norm(r.text); });
  }
  function snippet(text, term) {
    var n = norm(text), t = norm(term), i = n.indexOf(t); if (i < 0) return esc(text.slice(0, 140));
    var a = Math.max(0, i - 60), b = Math.min(text.length, i + t.length + 90);
    return (a ? "…" : "") + esc(text.slice(a, i)) + "<mark>" + esc(text.slice(i, i + t.length)) + "</mark>" + esc(text.slice(i + t.length, b)) + (b < text.length ? "…" : "");
  }
  function pageSearch(term) {
    sidebar("search"); crumbs([["RevyzMed", "#/"], ["Recherche"]]);
    if (!SIDX) buildIndex();
    app.innerHTML = '<div class="page fade" style="padding-top:28px"><h1 class="ptitle" style="margin-top:6px">Recherche</h1><p class="psub">Dans les fiches de cours et dans les questions.</p>' +
      '<label class="search">' + ic("search") + '<input id="sq" type="search" placeholder="Ex. : cartilage de conjugaison, cellules pariétales, GIST…" autocomplete="off"></label><div id="hits" style="margin-top:16px"></div></div>';
    var inp = $("#sq"); inp.value = term; inp.focus();
    var tmr = null;
    function run() {
      var t = inp.value.trim(), nt = norm(t), hits = $("#hits");
      try { history.replaceState(null, "", "#/recherche/" + encodeURIComponent(t)); } catch (e) {}
      if (nt.length < 2) { hits.innerHTML = '<p class="empty">Tape au moins 2 lettres.</p>'; return; }
      var f = SIDX.filter(function (r) { return r.k === "f" && r.n.indexOf(nt) >= 0; }), qq = SIDX.filter(function (r) { return r.k === "q" && r.n.indexOf(nt) >= 0; });
      var h = "";
      h += '<h2 class="sec">Fiches de cours (' + f.length + ")</h2>";
      h += f.slice(0, 40).map(function (r) {
        var L = LESSONS[r.lid];
        return '<a class="hit" href="#/l/' + r.lid + "/fiche/" + r.page + "~" + encodeURIComponent(t) + '"><div class="h">' + ic("doc") + esc(L.title) + ' <span class="tag gray">p. ' + r.page + '</span></div><div class="s">' + snippet(r.text, t) + "</div></a>";
      }).join("") || '<p class="empty">Aucun résultat dans les fiches.</p>';
      h += '<h2 class="sec">Questions (' + qq.length + ")</h2>";
      h += qq.slice(0, 40).map(function (r) {
        var q = Q[r.id], L = LESSONS[q.lesson], i = BYLESSON[q.lesson].indexOf(r.id);
        return '<a class="hit" href="javascript:void 0" data-q="' + q.lesson + "|" + i + '"><div class="h"><span class="tag">' + esc(TYPE_LABEL[q.type]) + "</span>" + esc(L.short || L.title) + " · question " + (i + 1) + '</div><div class="s">' + snippet(r.text, t) + "</div></a>";
      }).join("") || '<p class="empty">Aucune question.</p>';
      hits.innerHTML = h;
      $$("[data-q]", hits).forEach(function (a) { a.addEventListener("click", function () { var p = a.getAttribute("data-q").split("|"); startPractice(p[0], +p[1]); }); });
    }
    inp.addEventListener("input", function () { clearTimeout(tmr); tmr = setTimeout(run, 160); });
    if (term) run();
  }

  /* ------------------------------------------------------------ paramètres */
  var M = $("#settings");
  $("#setBtn").addEventListener("click", function () { syncSettings(); M.hidden = false; });
  M.addEventListener("click", function (e) { if (e.target === M || e.target.closest("[data-close]")) M.hidden = true; });
  $("#sPal").innerHTML = PALS.map(function (p) { return '<button class="sw" data-p="' + p[0] + '"><i style="background:' + p[2] + '"></i>' + p[1] + "</button>"; }).join("");
  $$("#sPal .sw").forEach(function (b) { b.addEventListener("click", function () { setPal(b.getAttribute("data-p")); }); });
  $$("#sMode button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-v")); }); });
  function syncSettings() {
    var pal = document.documentElement.getAttribute("data-palette") || "graphite";
    $$("#sPal .sw").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-p") === pal); });
    $$("#sMode button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === mode()); });
    $("#sTimer").checked = S.timer; $("#timerOpts").style.display = S.timer ? "" : "none";
    $$("#sTimerMode button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === S.timerMode); });
    $("#rQ").style.display = S.timerMode === "q" ? "" : "none"; $("#rT").style.display = S.timerMode === "t" ? "" : "none";
    $("#sTimerQ").value = S.timerQ; $("#sTimerT").value = S.timerT;
    $("#oQ").textContent = (S.timerQ >= 60 ? Math.floor(S.timerQ / 60) + " min" + (S.timerQ % 60 ? " " + S.timerQ % 60 + " s" : "") : S.timerQ + " s") + " / question";
    $("#oT").textContent = S.timerT + " min au total";
    $("#sTimerBank").checked = S.timerBank; $("#sInstant").checked = S.instant; $("#sN").textContent = S.n;
  }
  function commit() { save("rv.settings", S); syncSettings(); }
  $("#sTimer").addEventListener("change", function () { S.timer = this.checked; commit(); });
  $$("#sTimerMode button").forEach(function (b) { b.addEventListener("click", function () { S.timerMode = b.getAttribute("data-v"); commit(); }); });
  $("#sTimerQ").addEventListener("input", function () { S.timerQ = +this.value; commit(); });
  $("#sTimerT").addEventListener("input", function () { S.timerT = +this.value; commit(); });
  $("#sTimerBank").addEventListener("change", function () { S.timerBank = this.checked; commit(); });
  $("#sInstant").addEventListener("change", function () { S.instant = this.checked; commit(); });
  $("#nM").addEventListener("click", function () { S.n = Math.max(5, S.n - 5); commit(); });
  $("#nP").addEventListener("click", function () { S.n = Math.min(80, S.n + 5); commit(); });
  $("#sReset").addEventListener("click", function () {
    var b = this; if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = "Confirmer ?"; return; }
    P = {}; LAST = {}; save("rv.progress", P); save("rv.last", LAST); b.textContent = "Effacé ✓"; delete b.dataset.armed;
  });
  new MutationObserver(function () { if (M.hidden && !/quiz|resultats/.test(location.hash)) route(); }).observe(M, { attributes: true, attributeFilter: ["hidden"] });

  route();
})();

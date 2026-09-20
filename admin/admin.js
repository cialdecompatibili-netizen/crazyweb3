/* Admin crazyweb3 - al-folio v1. Vedi admin/claude.md */
var A = (function () {
  var TOK = '', REPO = '', BR = 'main', main, busy = false, BASEURL = '';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var b64e = function (s) { return btoa(unescape(encodeURIComponent(s))); };
  var b64d = function (s) { return decodeURIComponent(escape(atob(s.replace(/\n/g, '')))); };

  function toast(m, err) {
    var t = $('toast'); t.textContent = m; t.style.background = err ? '#b32d2e' : '#1d2327';
    t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(function () { t.style.display = 'none'; }, 3500);
  }

  function api(method, path, body) {
    var o = { method: method, headers: { Authorization: 'token ' + TOK, Accept: 'application/vnd.github+json' } };
    if (body) { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; }
    return fetch('https://api.github.com/repos/' + REPO + path, o).then(function (r) {
      if (r.status === 204) return {};
      return r.json().then(function (j) {
        if (!r.ok) { var e = new Error(j.message || r.status); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function errMsg(e) {
    if (e.status === 401) return 'Token non valido o scaduto (401)';
    if (e.status === 404) return 'Non trovato (404): controlla repo e token';
    if (e.status === 409 || e.status === 422) return 'Conflitto: ricarica e riprova (' + e.status + ')';
    return e.message;
  }
  function getDir(p) { return api('GET', '/contents/' + p + '?ref=' + BR).catch(function (e) { if (e.status === 404) return []; throw e; }); }
  function getFile(p) { return api('GET', '/contents/' + p + '?ref=' + BR).then(function (j) { j.text = b64d(j.content); return j; }); }
  /* GitHub Contents API usa concorrenza ottimistica: PUT/DELETE su un file esistente RICHIEDONO
     lo sha corrente (letto con getFile), altrimenti 409/422 "conflitto". Se due salvataggi sullo
     stesso file partono ravvicinati (doppio click, due tab aperte) il secondo puo' fallire con
     409 perche' lo sha che ha in mano non e' piu' quello vero: in quel caso l'utente deve
     ricaricare la vista (A.go) per riprendere lo sha aggiornato, NON ritentare con lo sha vecchio.
     wrap() (sotto) previene solo il doppio click nella STESSA vista, non le due tab aperte. */
  function putFile(p, text, sha, msg, isB64) {
    var b = { message: msg || 'admin: aggiorna ' + p, content: isB64 ? text : b64e(text), branch: BR };
    if (sha) b.sha = sha;
    return api('PUT', '/contents/' + p, b).then(function (r) { pollDeploy(); return r; });
  }
  function delFile(p, sha) {
    return api('DELETE', '/contents/' + p, { message: 'admin: elimina ' + p, sha: sha, branch: BR }).then(function (r) { pollDeploy(); return r; });
  }

  /* ---- front matter ----
     Jekyll legge il front matter YAML col parser Psych (Ruby). Fonti: jekyllrb.com/docs/front-matter,
     jekyllrb.com/docs/configuration/options (flag "future"), jekyllrb.com/docs/posts (tags/categories).
     - fmSet/fmGet lavorano riga per riga con regex: assumono "chiave: valore" su UNA riga, senza
       andare a capo (i blocchi multilinea come "children:" in admin-menu.js sono gestiti a parte,
       NON con fmGet/fmSet). Se un valore contiene "\n" queste funzioni lo rompono.
     - yq() quota SOLO se serve (caratteri speciali YAML o spazi ai bordi). NON usarla per "date":
       scritta senza virgolette (es. 2026-09-20 14:47:00) Psych la legge come un vero oggetto Time.
       E' il valore che Jekyll confronta con l'ora corrente per decidere se un post e' "nel futuro":
       la CLI ha il flag --future (default false, cioe' i post con data futura NON vengono
       pubblicati) — vedi jekyllrb.com/docs/configuration/options#build-command-options. Quotare la
       data la rende una stringa qualsiasi anziche' un Time: il confronto puo' comportarsi in modo
       incoerente a seconda della versione di Jekyll -> post che spariscono da blog/home senza
       errori in build. Per questo admin-views.js gestisce "date" con un <input type=date>+
       <input type=time> nativo invece che testo libero, e la scrive SEMPRE non quotata (vedi
       A.save() li'). Non reintrodurre yq() su "date".
     - "categories" e "tags" hanno gestione Jekyll dedicata (jekyllrb.com/docs/posts#tags-and-categories):
       una stringa con spazi in front matter viene AUTOMATICAMENTE splittata in un array (es.
       "categories: sport cronaca" -> ["sport","cronaca"]). E' l'UNICA ragione per cui l'admin puo'
       permettersi di salvare piu' categorie come stringa unica separata da spazi: non serve
       costruire un array YAML a mano. Questo split automatico vale SOLO per categories/tags,
       nessun altro campo del front matter lo riceve. */
  function splitFM(t) {
    var m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    return m ? { fm: m[1], body: m[2] } : { fm: '', body: t };
  }
  function fmGet(fm, k) {
    var m = fm.match(new RegExp('^' + k + ':[ \\t]*(.*)$', 'm'));
    if (!m) return '';
    return m[1].trim().replace(/^["']|["']$/g, '');
  }
  function fmSet(fm, k, v) {
    var line = k + ': ' + v, re = new RegExp('^' + k + ':.*$', 'm');
    if (re.test(fm)) return fm.replace(re, function () { return line; });
    return (fm ? fm + '\n' : '') + line;
  }
  function fmDel(fm, k) { return fm.replace(new RegExp('^' + k + ':.*\\r?\\n?', 'm'), ''); }
  function yq(s) { s = String(s); return /[:#'"\[\]{}&*!|>%@`]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s; }
  function slugify(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'senza-titolo'; }
  function today() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function now() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return today() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':00'; }

  /* ---- deploy status: build ("Deploy site") + pubblicazione ("pages build and deployment") ----
     Due workflow GitHub distinti, in sequenza: "Deploy site" (definito in questo repo,
     .github/workflows/deploy.yml) builda il sito Jekyll; a build finita GitHub Pages lancia in
     automatico un secondo workflow di sistema chiamato "pages build and deployment" che pubblica
     l'artifact. Il sito e' online solo quando ENTRAMBI risultano "completed"/"success". */
  var pt, pf;
  function setDeploy(cls, txt, pct) {
    var dot = $('deployDot'), t = $('deployTxt'), bar = $('deployBar');
    dot.className = 'dot ' + cls; t.textContent = txt; bar.style.width = pct + '%';
    if (pct >= 100) setTimeout(function () { bar.style.width = '0%'; }, 1500);
  }
  function pollDeploy() {
    clearTimeout(pt); clearInterval(pf);
    /* t0 = "5 secondi prima di adesso" e serve a scartare run vecchie quando si interroga la
       lista GET /actions/runs (torna le piu' recenti, non solo quelle innescate da QUESTO
       salvataggio). E' un confronto tra l'orologio del browser dell'utente e i timestamp che
       GitHub assegna ai run (UTC, orologio dei suoi server): un margine di 5s copre normali
       piccole discrepanze, ma su un client con orologio molto sballato puo' far perdere la run
       giusta (rientrerebbe tra quelle "vecchie") o, viceversa, far agganciare una run precedente
       ancora recente. Non e' un problema documentato da GitHub, e' un limite intrinseco del
       confrontare un'ora locale con un'ora server senza sincronizzazione esplicita. */
    var t0 = new Date(Date.now() - 5000).toISOString(), pct = 5, n = 0;
    setDeploy('run', 'Deploy in corso...', pct);
    pf = setInterval(function () { if (pct < 85) { pct += pct < 40 ? 2 : 0.6; $('deployBar').style.width = pct + '%'; } }, 1500);
    (function tick() {
      api('GET', '/actions/runs?branch=' + BR + '&per_page=10').then(function (r) {
        var runs = (r.workflow_runs || []).filter(function (x) { return x.created_at >= t0; });
        var b = runs.filter(function (x) { return x.name === 'Deploy site'; })[0];
        var p = runs.filter(function (x) { return x.name === 'pages build and deployment'; })[0];
        if (b && b.status === 'completed' && b.conclusion !== 'success') { clearInterval(pf); setDeploy('ko', 'Build fallita', 100); return; }
        if (p && p.status === 'completed') {
          clearInterval(pf);
          if (p.conclusion === 'success') setDeploy('ok', 'Sito aggiornato', 100); else setDeploy('ko', 'Pubblicazione fallita', 100);
          return;
        }
        if (b && b.status === 'completed') $('deployTxt').textContent = 'Pubblicazione...';
        else if (b) $('deployTxt').textContent = 'Build in corso...';
        if (++n < 60) pt = setTimeout(tick, 5000); else { clearInterval(pf); setDeploy('', 'Controlla su GitHub', 0); }
      }).catch(function () { clearInterval(pf); setDeploy('', 'Stato non disponibile', 0); });
    })();
  }
  function lastDeploy() { // stato iniziale all'apertura
    api('GET', '/actions/runs?branch=' + BR + '&per_page=10').then(function (r) {
      var p = (r.workflow_runs || []).filter(function (x) { return x.name === 'pages build and deployment'; })[0];
      if (!p) return setDeploy('', 'Nessun deploy', 0);
      if (p.status !== 'completed') return pollDeploy();
      setDeploy(p.conclusion === 'success' ? 'ok' : 'ko', p.conclusion === 'success' ? 'Sito aggiornato' : 'Ultimo deploy fallito', 0);
    }).catch(function () { });
  }

  /* ---- login / nav ---- */
  function login() {
    TOK = $('tok').value.trim(); REPO = $('repo').value.trim();
    if (!TOK || !REPO) { $('loginMsg').textContent = 'Inserisci token e repo'; return; }
    api('GET', '').then(function (r) {
      localStorage.setItem('adm_tok', TOK); localStorage.setItem('adm_repo', REPO);
      BR = r.default_branch || 'main'; start();
    }).catch(function (e) { $('loginMsg').textContent = errMsg(e); });
  }
  function logout() { localStorage.removeItem('adm_tok'); location.reload(); }
  function start() {
    $('login').style.display = 'none'; $('app').style.display = 'block';
    $('repoName').textContent = REPO; main = $('main'); go('dash');
    var parts = REPO.split('/'), user = parts[0], repoName = parts[1];
    $('siteLink').href = 'https://' + user + '.github.io/' + repoName + '/';
    $('deployLink').href = 'https://github.com/' + REPO + '/actions';
    lastDeploy();
    /* baseurl (letto sotto, async) e' la variabile Jekyll standard che al-folio usa per generare
       i link del sito (vedi al-folio docs/CUSTOMIZE.md, sezione "Configuration": "the url and
       baseurl settings are used to generate the links of the website"). E' l'unica fonte di
       verita' per il sottopercorso del sito (qui /crazyweb3): non va MAI hardcodato altrove
       nell'admin (vedi claude.md sez. 0, filosofia zero-hardcoded). BASEURL e' letto qui in modo
       ASINCRONO (arriva dopo start()), quindi qualsiasi modulo che usa A.baseurl() nel PRIMO
       render dopo il login puo' trovarlo ancora '' per una frazione di secondo. Non e' un bug
       bloccante (il caso d'uso e' il bottone Img della toolbar markdown, cliccato dall'utente ben
       dopo il caricamento), ma se in futuro serve BASEURL per costruire qualcosa a schermata gia'
       pronta, aspettare questa Promise invece di leggere A.baseurl() a freddo. */
    getFile('_config.yml').then(function (f) {
      var m = f.text.match(/^baseurl:\s*(.*)$/m);
      BASEURL = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    }).catch(function () { });
  }
  function toggleMenu(f) {
    var s = $('side'), o = $('overlay'), on = f === undefined ? !s.classList.contains('open') : f;
    s.classList.toggle('open', on); o.classList.toggle('open', on);
  }
  var titles = { dash: 'Bacheca', posts: 'Articoli', pages: 'Pagine', menu: 'Menu', projects: 'Progetti', news: 'News', media: 'Immagini', settings: 'Impostazioni' };
  function go(p) {
    var links = document.querySelectorAll('.side a[data-p]');
    for (var i = 0; i < links.length; i++) links[i].classList.toggle('on', links[i].getAttribute('data-p') === p);
    $('topTitle').textContent = titles[p] || ''; toggleMenu(false);
    main.innerHTML = '<div class="card">Caricamento...</div>';
    var f = views[p]; if (f) f().catch(function (e) { main.innerHTML = '<div class="card">Errore: ' + esc(errMsg(e)) + '</div>'; });
  }
  function wrap(fn) { // evita doppio click su salvataggi
    return function () {
      if (busy) return; busy = true; var a = arguments;
      return Promise.resolve().then(function () { return fn.apply(null, a); })
        .catch(function (e) { toast(errMsg(e), true); })
        .then(function () { busy = false; });
    };
  }

  var views = {};
  var api_ = { $: $, esc: esc, toast: toast, getDir: getDir, getFile: getFile, putFile: putFile, delFile: delFile,
    splitFM: splitFM, fmGet: fmGet, fmSet: fmSet, fmDel: fmDel, yq: yq, slugify: slugify, today: today, now: now,
    wrap: wrap, views: views, go: go, main: function () { return main; }, errMsg: errMsg, api: api,
    baseurl: function () { return BASEURL; } };

  /*__MODULI__*/

  window.addEventListener('load', function () {
    TOK = localStorage.getItem('adm_tok') || ''; REPO = localStorage.getItem('adm_repo') || '';
    $('repo').value = REPO;
    if (TOK) { api('GET', '').then(function (r) { BR = r.default_branch || 'main'; start(); }).catch(function () { $('login').style.display = 'flex'; }); }
  });
  api_.login = login; api_.logout = logout; api_.toggleMenu = toggleMenu;
  return api_;
})();

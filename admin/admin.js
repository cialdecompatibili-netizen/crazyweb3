/* Admin - al-folio v1. Vedi admin/claude.md */
var A = (function () {
  /* CHIAVI DEL BROWSER (localStorage) - regola "zero hardcoded" + "piu' siti sullo stesso dominio":
     il browser tiene i dati PER DOMINIO, non per sito. Due siti GitHub Pages dello stesso utente
     (utente.github.io/sito-a/ e utente.github.io/sito-b/) hanno lo STESSO dominio: con chiavi fisse (adm_tok, adm_repo)
     il secondo admin trovava token e repo del primo e SCRIVEVA SUL REPO SBAGLIATO. Bug reale visto tra due siti clonati uno dall'altro.
     Soluzione: il nome della chiave contiene il percorso dell'admin (location.pathname senza il nome del file),
     che e' diverso per ogni sito e non va scritto a mano. Es. /nome-repo/admin/ -> adm_tok:/nome-repo/admin/
     [FONTE: MDN Web Storage API, localStorage e' separato per origine (schema+host+porta), non per percorso.] */
  var SCOPE = location.pathname.replace(/[^\/]*$/, ''), K_TOK = 'adm_tok:' + SCOPE, K_REPO = 'adm_repo:' + SCOPE;
  var TOK = '', REPO = '', BR = 'main', main, busy = false, BASEURL = '';
  /* SKEW = (ora server GitHub) - (ora del PC), in millisecondi. Aggiornato a ogni chiamata API.
     SITE_TZ = fuso del sito, letto da "timezone:" in _config.yml (mai scritto qui: vedi sez. 0 claude.md).
     Ordine di fiducia per l'ora dei post: GitHub (Date header) > orologio PC. Il fuso NON viene dal PC. */
  var SKEW = 0, SITE_TZ = '', SITEURL = '';
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
      /* OROLOGIO: ogni risposta GitHub porta l'header "Date" (ora esatta del server, UTC). Lo confronto
         con l'orologio del PC e tengo lo scarto in SKEW. Cosi' un PC con l'ora sballata non altera
         piu' la data dei post ne' la finestra del deploy. Vedi serverNow() e admin/claude.md sez. 0e.
         Se l'header manca o e' illeggibile SKEW resta com'era: si ricade sull'orologio del PC. */
      var sd = r.headers.get('Date'), st = sd ? Date.parse(sd) : NaN;
      if (!isNaN(st)) SKEW = st - Date.now();
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
  /* delFile: DELETE su GitHub Contents API richiede lo sha corrente del file (stessa concorrenza ottimistica di putFile). Va sempre letto un attimo prima con getFile: uno sha vecchio da' 409. Dopo l'eliminazione parte pollDeploy() perche' la cancellazione e' un commit e fa ripartire il build. [FONTE: docs.github.com REST 'Delete a file'] */
  function delFile(p, sha) {
    return api('DELETE', '/contents/' + p, { message: 'admin: elimina ' + p, sha: sha, branch: BR }).then(function (r) { pollDeploy(); return r; });
  }

  /* commitFiles(changes, message): UN SOLO commit con piu' file insieme (aggiunte, modifiche, cancellazioni).
     Serve ai MODULI (admin-modules.js): installare/disinstallare un modulo tocca 5-30 file, e con putFile/
     delFile sarebbero 5-30 commit = 5-30 build "Deploy site" in coda, e un'operazione a meta' se la rete cade.
     Con un commit solo l'operazione e' ATOMICA: o entrano tutti i file o nessuno.
       changes = [ {path:'a/b.md', text:'...'}   (testo UTF-8)
                 | {path:'x.png', b64:'...'}     (contenuto gia' in base64, SENZA prefisso 'data:...;base64,')
                 | {path:'old.md', del:true} ]   (cancella)
     Sequenza (Git Data API) [DOC GitHub REST: docs.github.com/rest/git/refs, /commits, /blobs, /trees]:
       1. GET  git/ref/heads/<branch>  -> sha del commit in cima
       2. GET  git/commits/<sha>       -> sha dell'albero (tree) di quel commit
       3. POST git/blobs   (uno per file) -> sha del contenuto
       4. POST git/trees   {base_tree, tree:[...]} -> nuovo albero. base_tree = albero attuale: i file NON elencati restano
          identici, quelli elencati vengono sovrascritti [DOC GitHub "Create a tree"].
       5. POST git/commits {message, tree, parents:[sha]}
       6. PATCH git/refs/heads/<branch> {sha, force:false}  -> il branch avanza al nuovo commit.
     TRAPPOLE (tutte dalla doc "Create a tree", verificata):
       - sha:null in una voce dell'albero CANCELLA il file, MA "returns an error if you try to delete a file that does not exist":
         una cancellazione di un file gia' sparito farebbe fallire TUTTO il commit. Per questo le cancellazioni vengono filtrate
         contro l'albero reale (listExisting) e i file assenti sono saltati in silenzio.
       - force:false al punto 6 = solo avanzamento lineare: se nel frattempo qualcuno ha committato (altra scheda, altra sessione)
         GitHub risponde 422 e NON sovrascrive niente; errMsg() lo mostra come "Conflitto: ricarica e riprova".
       - le operazioni sono SEQUENZIALI apposta: la doc avverte che questi endpoint rispondono 422 se "spammati" con richieste parallele.
       - il commit parte SOLO se cambia qualcosa: se dopo il filtro non resta nessuna voce, non crea commit e ritorna null.
     Dopo il commit parte pollDeploy() (pallino verde/rosso), come putFile/delFile. Il commit va sul branch BR (quello di login).
     I percorsi sono validati: niente '/' iniziale, niente '..', niente vuoti - protegge da uno zip malevolo o da un bug del chiamante. */
  function commitFiles(changes, message) {
    if (!changes || !changes.length) return Promise.resolve(null);
    changes.forEach(function (c) {
      if (!c.path || /^\//.test(c.path) || /(^|\/)\.\.(\/|$)/.test(c.path) || /\/\//.test(c.path)) throw new Error('Percorso non valido: ' + c.path);
    });
    var headSha, baseTree, entries = [];
    /* listExisting: quali dei percorsi da cancellare esistono davvero. Un solo giro con l'albero ricorsivo; se GitHub risponde
       "truncated" (repo enorme, oltre il limite della doc) si ripiega su un controllo per file con la Contents API (404 = assente). */
    function listExisting(paths) {
      var have = {};
      return api('GET', '/git/trees/' + baseTree + '?recursive=1').then(function (t) {
        if (!t.truncated) { (t.tree || []).forEach(function (n) { have[n.path] = true; }); return have; }
        return paths.reduce(function (pr, p) {
          return pr.then(function () {
            return api('GET', '/contents/' + p.split('/').map(encodeURIComponent).join('/') + '?ref=' + BR)
              .then(function () { have[p] = true; }, function (e) { if (e.status !== 404) throw e; });
          });
        }, Promise.resolve()).then(function () { return have; });
      });
    }
    return api('GET', '/git/ref/heads/' + BR).then(function (ref) {
      headSha = ref.object.sha; return api('GET', '/git/commits/' + headSha);
    }).then(function (c) {
      baseTree = c.tree.sha;
      var dels = changes.filter(function (x) { return x.del; }).map(function (x) { return x.path; });
      return dels.length ? listExisting(dels) : {};
    }).then(function (have) {
      return changes.reduce(function (pr, ch) {
        return pr.then(function () {
          if (ch.del) { if (have[ch.path]) entries.push({ path: ch.path, mode: '100644', type: 'blob', sha: null }); return; }
          var b64 = ch.b64 != null ? ch.b64 : b64e(ch.text == null ? '' : ch.text);
          return api('POST', '/git/blobs', { content: b64, encoding: 'base64' }).then(function (bl) {
            entries.push({ path: ch.path, mode: '100644', type: 'blob', sha: bl.sha });
          });
        });
      }, Promise.resolve());
    }).then(function () {
      if (!entries.length) return null;
      return api('POST', '/git/trees', { base_tree: baseTree, tree: entries }).then(function (t) {
        return api('POST', '/git/commits', { message: message || 'admin: aggiornamento', tree: t.sha, parents: [headSha] });
      }).then(function (nc) {
        return api('PATCH', '/git/refs/heads/' + BR, { sha: nc.sha, force: false }).then(function () { pollDeploy(); return nc; });
      });
    });
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
     - "categories" e "tags" hanno gestione Jekyll dedicata [DOC Jekyll: wiki repo jekyll/jekyll, pagina "YAML Front Matter": "can be specified as a YAML list or a space-separated string"; verificata leggendo la pagina, NON l'ancora #tags-and-categories di jekyllrb.com che avevo citato senza averla aperta]:
       una stringa con spazi in front matter viene AUTOMATICAMENTE splittata in un array (es.
       "categories: sport cronaca" -> ["sport","cronaca"]). E' l'UNICA ragione per cui l'admin puo'
       permettersi di salvare piu' categorie come stringa unica separata da spazi: non serve
       costruire un array YAML a mano. Questo split automatico vale SOLO per categories/tags,
       nessun altro campo del front matter lo riceve. */
  function splitFM(t) {
    var m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    return m ? { fm: m[1], body: m[2] } : { fm: '', body: t };
  }
  /* fmGet/fmSet/fmDel lavorano riga per riga con regex sul front matter: assumono 'chiave: valore' su UNA riga. Il flag 'm' fa combaciare ^ e $ con ogni riga. La chiave finisce dentro una RegExp: passare solo nomi semplici (title, date, seo_title), MAI input dell'utente (un punto o un asterisco cambierebbero il significato). fmGet toglie le virgolette esterne; fmSet NON quota (il chiamante decide se usare yq). Un valore multilinea (children:, more_info: >) NON e' gestito qui: vedi kids() in admin-menu.js. [FONTE: front matter = YAML, jekyllrb.com/docs/front-matter] */
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
  /* yq: quota SOLO se serve. Caratteri che in YAML hanno significato speciale (: # [ ] { } & * ! | > % @ ') o spazi ai bordi -> stringa tra virgolette doppie, con \"\ interni escapati. Senza questo un titolo tipo 'Guida: come fare' rompe il front matter e il post sparisce dal build senza errori evidenti. NON usarla per date, booleani e numeri (vedi sez. 0c claude.md): quotati diventano stringhe. [FONTE: YAML 1.1, Psych di Jekyll] */
  function yq(s) { s = String(s); return /[:#'"\[\]{}&*!|>%@`]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s; }
  /* slugify: nome file di post/pagine. Toglie accenti (NFD), tiene solo a-z 0-9, il resto diventa '-'. Il nome del post deve restare 'YYYY-MM-DD-titolo.md': Jekyll ricava data e permalink da li'. [FONTE: al-folio docs/CUSTOMIZE.md, 'The name of the file must follow the format YYYY-MM-DD-title.md'] Attenzione: due titoli diversi possono dare lo stesso slug (es. 'Ciao!' e 'Ciao?'): il secondo sovrascriverebbe il primo se la data coincide. */
  function slugify(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'senza-titolo'; }
  /* ORA DEI POST (punto critico, vedi admin/claude.md sez. 0e):
     - serverNow(): ora ESATTA = orologio PC + SKEW (scarto misurato contro l'header Date di GitHub).
       Un PC con l'ora sballata non altera piu' la data dei post. Se SKEW non e' ancora noto vale 0.
     - Il fuso e' quello del SITO (SITE_TZ, da _config.yml "timezone:"), non quello del PC: cosi'
       il risultato e' identico su ogni computer. Intl.DateTimeFormat con timeZone fa lui l'ora legale.
     - Output "YYYY-MM-DD HH:MM:00" SENZA fuso e SENZA virgolette: Jekyll lo rilegge in "timezone:"
       (regola sez. 0c). Non aggiungere offset qui.
     - Se SITE_TZ e' vuoto o non valido (nome sbagliato in config) si ripiega sul fuso del PC. */
  function serverNow() { return new Date(Date.now() + SKEW); }
  function siteParts(d) {
    var o = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    var f;
    try { if (SITE_TZ) { o.timeZone = SITE_TZ; } f = new Intl.DateTimeFormat('en-CA', o); }
    catch (e) { delete o.timeZone; f = new Intl.DateTimeFormat('en-CA', o); }
    var p = {}; f.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    if (p.hour === '24') p.hour = '00';
    return p;
  }
  function today() { var p = siteParts(serverNow()); return p.year + '-' + p.month + '-' + p.day; }
  function now() { var p = siteParts(serverNow()); return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':00'; }

  /* ---- deploy status: build ("Deploy site") + pubblicazione ("pages build and deployment") ----
     Due workflow GitHub distinti, in sequenza: "Deploy site" (definito in questo repo,
     .github/workflows/deploy.yml) builda il sito Jekyll; a build finita GitHub Pages lancia in
     automatico un secondo workflow di sistema chiamato "pages build and deployment" che pubblica
     l'artifact. Il sito e' online solo quando ENTRAMBI risultano "completed"/"success".

     FIX 2026-09-20: il pallino restava bloccato su "Deploy in corso..." anche a build finita.
     Causa 1: t0 confrontava x.created_at (formato GitHub "YYYY-MM-DDTHH:MM:SSZ", SENZA millisecondi)
     con new Date().toISOString() (SEMPRE con millisecondi, "...SSS Z"): un confronto tra stringhe di
     formato diverso, quindi via epoch (Date.parse) invece che testo, niente piu' ambiguita'.
     Causa 2 (la piu' probabile in pratica): per_page=10 e' troppo poco quando in una sessione si
     fanno piu' salvataggi ravvicinati (ogni salvataggio genera 2 run: Deploy site + pages build and
     deployment). Con 5-6 salvataggi in pochi minuti la run cercata puo' finire oltre la decima
     posizione e sparire dal filtro: pollDeploy() continua a girare aspettando una run che nella
     pagina 1 non c'e' piu'. per_page alzato a 30 sia qui che in lastDeploy(). */
  var pt, pf;
  function setDeploy(cls, txt, pct) {
    var dot = $('deployDot'), t = $('deployTxt'), bar = $('deployBar');
    dot.className = 'dot ' + cls; t.textContent = txt; bar.style.width = pct + '%';
    if (pct >= 100) setTimeout(function () { bar.style.width = '0%'; }, 1500);
  }
  function pollDeploy() {
    clearTimeout(pt); clearInterval(pf);
    /* t0 in epoch (numero, non stringa): "5 secondi prima di adesso" per scartare run vecchie
       quando si interroga /actions/runs (torna le piu' recenti, non solo quelle di QUESTO
       salvataggio). "adesso" e' serverNow() (ora GitHub via header Date), NON new Date(): con un
       PC dall'orologio sballato la run giusta finirebbe tra le "vecchie" e il pallino resterebbe
       in attesa per sempre. Il confronto sotto usa Date.parse(x.created_at) per lo stesso motivo:
       niente confronto tra stringhe di formato diverso (vedi commento sopra la funzione). */
    var t0 = serverNow().getTime() - 5000, pct = 5, n = 0;
    setDeploy('run', 'Deploy in corso...', pct);
    pf = setInterval(function () { if (pct < 85) { pct += pct < 40 ? 2 : 0.6; $('deployBar').style.width = pct + '%'; } }, 1500);
    (function tick() {
      api('GET', '/actions/runs?branch=' + BR + '&per_page=30').then(function (r) {
        var runs = (r.workflow_runs || []).filter(function (x) { var c = Date.parse(x.created_at); return !isNaN(c) && c >= t0; });
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
  /* lastDeploy: stato del pallino all'apertura dell'admin (senza aver appena salvato). Legge le ultime run di Actions. Stessa regola di pollDeploy: 'Deploy site' + 'pages build and deployment' devono essere ENTRAMBE completed/success prima di dire 'online'. per_page alzato a 30 per lo stesso motivo di pollDeploy (vedi commento sopra). */
  function lastDeploy() { // stato iniziale all'apertura
    api('GET', '/actions/runs?branch=' + BR + '&per_page=30').then(function (r) {
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
      localStorage.setItem(K_TOK, TOK); localStorage.setItem(K_REPO, REPO);
      BR = r.default_branch || 'main'; start();
    }).catch(function (e) { $('loginMsg').textContent = errMsg(e); });
  }
  function logout() { localStorage.removeItem(K_TOK); location.reload(); }
  /* start: eseguita dopo il login. Qui si leggono da _config.yml (async) baseurl e timezone. Finche' la Promise non e' risolta BASEURL e SITE_TZ sono vuoti: vedi commento piu' sotto e sez. 0e claude.md. */
  function start() {
    $('login').style.display = 'none'; $('app').style.display = 'block';
    $('repoName').textContent = REPO; main = $('main'); go('dash');
    var parts = REPO.split('/'), user = parts[0], repoName = parts[1];
    SITEURL = 'https://' + user + '.github.io/' + repoName + '/'; // vedi A.siteUrl(): usato dai moduli con file root/ (es. sitemap.xml) per mostrare l'URL pubblico completo
    $('siteLink').href = SITEURL;
    $('deployLink').href = 'https://github.com/' + REPO + '/actions';
    lastDeploy();
    /* baseurl (letto sotto, async) e' la variabile Jekyll standard che al-folio usa per generare
       i link del sito (vedi al-folio docs/CUSTOMIZE.md, sezione "Configuration": "the url and
       baseurl settings are used to generate the links of the website"). E' l'unica fonte di
       verita' per il sottopercorso del sito (es. /nome-repo): non va MAI hardcodato altrove
       nell'admin (vedi claude.md sez. 0, filosofia zero-hardcoded). BASEURL e' letto qui in modo
       ASINCRONO (arriva dopo start()), quindi qualsiasi modulo che usa A.baseurl() nel PRIMO
       render dopo il login puo' trovarlo ancora '' per una frazione di secondo. Non e' un bug
       bloccante (il caso d'uso e' il bottone Img della toolbar markdown, cliccato dall'utente ben
       dopo il caricamento), ma se in futuro serve BASEURL per costruire qualcosa a schermata gia'
       pronta, aspettare questa Promise invece di leggere A.baseurl() a freddo. */
    getFile('_config.yml').then(function (f) {
      /* baseurl: la riga in _config.yml ha un commento in coda ("baseurl: /nome-repo # the subpath...").
         Va tolto, altrimenti BASEURL diventa "/nome-repo # the subpath of your site..." e ogni percorso
         costruito con A.baseurl() (bottone Img, immagini) e' sbagliato. Trovato col test dal vivo col
         token reale: i test sulle singole funzioni non lo vedevano. Stessa regola del timezone sotto:
         il valore finisce al primo spazio o '#'. Un baseurl vuoto ("baseurl:" o "baseurl: ''") resta ''. */
      var m = f.text.match(/^baseurl:[ \t]*([^\s#]*)/m);
      BASEURL = m ? m[1].replace(/^["']|["']$/g, '') : '';
      /* timezone del sito: e' quello che Jekyll usa per leggere le date dei post (sez. 0c). L'admin
         deve scrivere l'ora nello STESSO fuso, altrimenti il post nasce sfasato. Il commento in coda
         alla riga ("timezone: Europe/Rome # ...") va tolto, altrimenti Intl lo rifiuta. */
      var tz = f.text.match(/^timezone:[ \t]*([^\s#]+)/m);
      SITE_TZ = tz ? tz[1].replace(/^["']|["']$/g, '') : '';
    }).catch(function () { });
  }
  function toggleMenu(f) {
    var s = $('side'), o = $('overlay'), on = f === undefined ? !s.classList.contains('open') : f;
    s.classList.toggle('open', on); o.classList.toggle('open', on);
  }
  var titles = { dash: 'Bacheca', posts: 'Articoli', pages: 'Pagine', menu: 'Menu', projects: 'Progetti', news: 'News', media: 'Immagini', modules: 'Moduli', settings: 'Impostazioni' };
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
    commitFiles: commitFiles, splitFM: splitFM, fmGet: fmGet, fmSet: fmSet, fmDel: fmDel, yq: yq, slugify: slugify,
    today: today, now: now, wrap: wrap, views: views, go: go, main: function () { return main; }, errMsg: errMsg, api: api,
    baseurl: function () { return BASEURL; }, siteUrl: function () { return SITEURL; } };

  /*__MODULI__*/

  window.addEventListener('load', function () {
    TOK = localStorage.getItem(K_TOK) || ''; REPO = localStorage.getItem(K_REPO) || '';
    /* REPO PRECOMPILATO DAL SITO STESSO (nessun nome scritto nel codice, principio guida sez. 00):
       un sito GitHub Pages vive su <utente>.github.io/<repo>/, quindi utente e repo si ricavano
       dall'indirizzo in cui l'admin e' aperto: host = utente.github.io, primo pezzo del percorso = repo.
       Vale SOLO se e' gia' salvato niente per questo sito, e solo per host *.github.io (con un dominio
       personalizzato non si puo' dedurre: il campo resta vuoto e lo compila l'utente).
       [FONTE: GitHub Docs, URL dei siti Pages 'project site': https://<utente>.github.io/<repo>/] */
    if (!REPO) {
      var hm = location.hostname.match(/^([^.]+)\.github\.io$/i), pm = location.pathname.match(/^\/([^\/]+)\//);
      if (hm && pm && pm[1] !== 'admin') REPO = hm[1] + '/' + pm[1]; // pm[1]=='admin': sito radice <utente>.github.io, il repo non e' nel percorso -> campo vuoto, lo compila l'utente
    }
    $('repo').value = REPO;
    if (TOK) { api('GET', '').then(function (r) { BR = r.default_branch || 'main'; start(); }).catch(function () { $('login').style.display = 'flex'; }); }
  });
  api_.login = login; api_.logout = logout; api_.toggleMenu = toggleMenu;
  return api_;
})();

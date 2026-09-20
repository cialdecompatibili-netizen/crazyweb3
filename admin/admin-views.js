/* Viste admin: Bacheca, Articoli, Progetti, News (lista + editor generico). Vedi claude.md */
(function (A) {
  var $ = A.$, esc = A.esc, M = function () { return A.main(); };

  /* ---- editor markdown: toolbar minima ---- */
  window.mdIns = function (a, b) {
    var t = $('body'), s = t.selectionStart, e = t.selectionEnd, v = t.value, sel = v.slice(s, e);
    t.value = v.slice(0, s) + a + sel + (b || '') + v.slice(e); t.focus();
    t.selectionStart = s + a.length; t.selectionEnd = s + a.length + sel.length;
  };
  function toolbar() {
    return '<div class="tools">' +
      '<button class="btn sm" onclick="mdIns(\'**\',\'**\')"><b>B</b></button>' +
      '<button class="btn sm" onclick="mdIns(\'*\',\'*\')"><i>I</i></button>' +
      '<button class="btn sm" onclick="mdIns(\'\\n## \',\'\')">H2</button>' +
      '<button class="btn sm" onclick="mdIns(\'\\n- \',\'\')">Lista</button>' +
      '<button class="btn sm" onclick="mdIns(\'[\',\'](https://)\')">Link</button>' +
      '<button class="btn sm" onclick="mdIns(\'![\',\'](\' + A.baseurl() + \'/assets/img/)\')">Img</button>' +
      '</div>';
  }
  function ymlList(fm) { return fm; }

  /* ---- Bacheca ---- */
  A.views.dash = function () {
    var dirs = [['_posts', 'Articoli', 'posts'], ['_pages', 'Pagine', 'pages'], ['_projects', 'Progetti', 'projects'], ['_news', 'News', 'news']];
    return Promise.all(dirs.map(function (d) { return A.getDir(d[0]); })).then(function (r) {
      var h = '<h2>Bacheca</h2><div class="row">';
      dirs.forEach(function (d, i) {
        var n = Array.isArray(r[i]) ? r[i].filter(function (x) { return x.type === 'file'; }).length : 0;
        h += '<div class="card" style="cursor:pointer" onclick="A.go(\'' + d[2] + '\')"><h3>' + n + '</h3>' + d[1] + '</div>';
      });
      h += '</div><div class="card">Ogni salvataggio fa un commit e il sito si aggiorna in 1-2 minuti (pallino in alto: verde = pubblicato).</div>';
      M().innerHTML = h;
    });
  };

  /* ---- vista generica collezione ---- */
  function collection(cfg) {
    A.views[cfg.key] = function () {
      return A.getDir(cfg.dir).then(function (files) {
        files = files.filter(function (f) { return f.type === 'file' && /\.md$/.test(f.name); });
        files.sort(function (a, b) { return cfg.sortDesc ? (a.name < b.name ? 1 : -1) : (a.name < b.name ? -1 : 1); });
        var h = '<h2>' + cfg.label + ' <button class="btn primary sm" onclick="A.edit(\'' + cfg.key + '\')">+ Nuovo</button></h2><div class="card list">';
        if (!files.length) h += 'Nessun elemento.';
        files.forEach(function (f) {
          h += '<div class="it"><span>' + esc(f.name) + '</span>' +
            '<button class="btn sm" onclick="A.edit(\'' + cfg.key + '\',\'' + esc(f.name) + '\')">Modifica</button>' +
            '<button class="btn sm danger" onclick="A.del(\'' + cfg.key + '\',\'' + esc(f.name) + '\')">Elimina</button></div>';
        });
        M().innerHTML = h + '</div>';
      });
    };
  }
  var C = {
    posts: { key: 'posts', dir: '_posts', label: 'Articoli', sortDesc: true },
    projects: { key: 'projects', dir: '_projects', label: 'Progetti' },
    news: { key: 'news', dir: '_news', label: 'News', sortDesc: true }
  };
  Object.keys(C).forEach(function (k) { collection(C[k]); });

  /* campi per collezione: [nome, etichetta, tipo] - 'cat' = dropdown categorie, 'date' = selettore data+ora nativo */
  /* SEO: due campi opzionali in fondo a ogni editor. Vuoti = la riga sparisce dal front matter
     (A.save() usa fmDel su valore vuoto) e il sito applica il fallback automatico definito in
     _includes/metadata.liquid (title = titolo pagina | sito; description = estratto del testo).
     Si chiamano seo_title/seo_description e NON "description" perche' in al-folio "description" e'
     anche il sottotitolo visibile nella pagina. Vedi admin/claude.md sez. 0d. */
  var SEO = [['seo_title', 'SEO Title (vuoto = usa il titolo)', 'text'], ['seo_description', 'SEO Description (vuoto = estratto automatico del testo)', 'text']];
  var FIELDS = {
    posts: [['title', 'Titolo', 'text'], ['date', 'Data', 'date'], ['description', 'Descrizione', 'text'], ['tags', 'Tag (separati da spazio)', 'text'], ['categories', 'Categoria', 'cat']].concat(SEO),
    projects: [['title', 'Titolo', 'text'], ['description', 'Descrizione', 'text'], ['img', 'Immagine (es. assets/img/12.jpg)', 'text'], ['importance', 'Ordine (numero)', 'text'], ['category', 'Categoria (deve stare in display_categories di projects)', 'cat'], ['redirect', 'Redirect esterno (opzionale)', 'text']].concat(SEO),
    news: [['title', 'Titolo (solo se non inline)', 'text'], ['date', 'Data', 'date'], ['inline', 'Inline (true = solo riga in home)', 'text']].concat(SEO)
  };
  var LAYOUT = { posts: 'post', projects: 'page', news: 'post' };
  /* campi mostrati SOTTO il Corpo nell'editor (vedi A.edit). Ordine = ordine in FIELDS. */
  var BELOW = ['tags', 'seo_title', 'seo_description'];
  var cur = {};

  /* parse "YYYY-MM-DD HH:MM:SS[ +ZZZZ]" -> {d:'YYYY-MM-DD', t:'HH:MM', tz:'+ZZZZ'|''}
     Perche' due input nativi (date + time) e non un campo testo: Jekyll legge "date:" come un vero
     oggetto Time solo se il valore e' un timestamp YAML valido; un valore malformato (es. una data
     scritta a mano con un refuso) viene letto come stringa e il post puo' sparire da blog/home
     senza alcun errore in build. Con <input type=date>/<input type=time> il browser garantisce
     il formato, quindi il valore scritto e' sempre valido (vedi commento su fmGet/fmSet in
     admin.js e save() sotto).
     Il fuso (tz) non e' modificabile da UI: se la data esistente lo contiene (es. "+0200") viene
     conservato in un campo hidden e riscritto identico al salvataggio, per non alterare l'orario
     di un post gia' pubblicato. Secondi sempre azzerati (":00"): l'input time lavora al minuto. */
  function parseDate(v) {
    var m = (v || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?\s*([+-]\d{4})?/);
    if (!m) return { d: '', t: '', tz: '' };
    return { d: m[1], t: m[2], tz: m[3] || '' };
  }
  function dateField(fd, v) {
    var id = 'f_' + fd[0], p = parseDate(v);
    return '<label>' + fd[1] + '</label><div class="row"><input type="date" id="' + id + '_d" value="' + esc(p.d) + '">' +
      '<input type="time" id="' + id + '_t" value="' + esc(p.t) + '" step="60"></div>' +
      '<input type="hidden" id="' + id + '_tz" value="' + esc(p.tz) + '">';
  }

  /* legge tutte le categorie gia' usate in una collezione (per il dropdown)
     Costo: 1 chiamata API per OGNI file della cartella (N post = N+1 richieste GitHub) ogni volta
     che si apre l'editor. Va bene per un blog piccolo; il rate limit per token autenticato e' di
     5000 richieste/ora, ma con centinaia di post l'apertura dell'editor diventa lenta. Se serve
     scalare, cachare il risultato per la sessione.
     Il campo e' 'categories' per i post e 'category' (singolare) per i progetti: sono due campi
     diversi in al-folio. Split per spazi: Jekyll tratta "categories: a b" come lista ["a","b"]
     (vedi commento su categories/tags in admin.js), quindi una categoria con spazio nel nome NON
     e' rappresentabile in questa forma. */
  function loadCats(key) {
    var field = key === 'projects' ? 'category' : 'categories';
    return A.getDir(C[key].dir).then(function (files) {
      files = files.filter(function (f) { return f.type === 'file' && /\.md$/.test(f.name); });
      return Promise.all(files.map(function (f) { return A.getFile(C[key].dir + '/' + f.name).catch(function () { return null; }); }));
    }).then(function (fs) {
      var set = {};
      fs.forEach(function (f) {
        if (!f) return;
        var v = A.fmGet(A.splitFM(f.text).fm, field);
        v.split(/\s+/).forEach(function (c) { c = c.trim(); if (c) set[c] = 1; });
      });
      return Object.keys(set).sort();
    });
  }

  function catField(fd, v) {
    var id = 'f_' + fd[0];
    var h = '<label>' + fd[1] + '</label><select id="' + id + '" onchange="if(this.value===\'__new__\'){this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';this.nextElementSibling.focus();}">';
    h += '<option value="">-- nessuna --</option>';
    (cur.cats || []).forEach(function (c) { h += '<option value="' + esc(c) + '"' + (c === v ? ' selected' : '') + '>' + esc(c) + '</option>'; });
    var known = (cur.cats || []).indexOf(v) >= 0 || v === '';
    h += '<option value="__new__">+ nuova categoria...</option></select>';
    h += '<input id="' + id + '_new" placeholder="Nuova categoria" style="display:' + (known ? 'none' : 'block') + '" value="' + (known ? '' : esc(v)) + '">';
    return h;
  }

  A.edit = function (key, name) {
    var p = name ? Promise.resolve(A.getFile(C[key].dir + '/' + name)) : Promise.resolve(null);
    Promise.all([p, loadCats(key)]).then(function (r) {
      var f = r[0]; cur = { key: key, name: name || '', sha: f ? f.sha : '', fm: f ? A.splitFM(f.text).fm : '', cats: r[1] };
      var body = f ? A.splitFM(f.text).body : '';
      var h = '<h2>' + (name ? 'Modifica ' + esc(name) : 'Nuovo in ' + C[key].label) + '</h2><div class="card">';
      /* ORDINE nell'editor: i campi normali stanno SOPRA il Corpo, quelli in BELOW ('tags' + i due SEO)
         stanno SOTTO, nell'ordine di FIELDS. Solo l'ordine visivo: save() legge ogni campo per id
         ("f_<nome>"), quindi non dipende dalla posizione. Se aggiungi un campo da mettere sotto il
         Corpo, aggiungilo a BELOW. */
      var top = '', below = '';
      FIELDS[key].forEach(function (fd) {
        var v = f ? A.fmGet(cur.fm, fd[0]) : '';
        /* data iniziale di un nuovo elemento: A.now() = ora GitHub nel fuso del sito, SENZA offset.
           Prima le news aggiungevano ' +0000': con "timezone: Europe/Rome" in config avrebbe spostato
           l'ora di 1-2 ore. Regola unica per tutte le collezioni (sez. 0c/0e claude.md). */
        if (!f && fd[0] === 'date') v = A.now();
        if (!f && fd[0] === 'inline') v = 'true';
        if (!f && fd[0] === 'importance') v = '1';
        var one;
        if (fd[2] === 'cat') one = catField(fd, v);
        else if (fd[2] === 'date') one = dateField(fd, v);
        else one = '<label>' + fd[1] + '</label><input id="f_' + fd[0] + '" value="' + esc(v) + '">';
        if (BELOW.indexOf(fd[0]) >= 0) below += one; else top += one;
      });
      h += top + '<label>Corpo (Markdown)</label>' + toolbar() + '<textarea id="body">' + esc(body) + '</textarea>' + below +
        '<p><button class="btn primary" onclick="A.save()">Salva e pubblica</button><button class="btn" onclick="A.go(\'' + key + '\')">Annulla</button></p></div>';
      M().innerHTML = h;
    }).catch(function (e) { A.toast(A.errMsg(e), true); });
  };

  /* A.save: scrive il front matter di articolo/progetto/news. PUNTI CRITICI: (1) 'date', 'inline', 'importance' vanno con fmSet DIRETTO, mai yq: devono restare timestamp/booleano/numero (sez. 0c). (2) valore vuoto = riga rimossa con fmDel, cosi' il sito usa il fallback (SEO, sez. 0d). (3) il nome file di un NUOVO post e' 'data-slug.md' con la data del campo Data: se la data e' nel futuro senza 'future: true' il post non esce (sez. 0c). (4) i campi si leggono per id 'f_<nome>': cambiare l'ordine visivo (BELOW) non tocca il salvataggio. [FONTE: naming file post, al-folio docs/CUSTOMIZE.md] */
  A.save = A.wrap(function () {
    var key = cur.key, fm = cur.fm || 'layout: ' + LAYOUT[key], name = cur.name;
    fm = A.fmSet(fm, 'layout', LAYOUT[key]);
    FIELDS[key].forEach(function (fd) {
      var k = fd[0], v;
      if (fd[2] === 'cat') {
        var sel = $('f_' + k).value;
        v = (sel === '__new__' ? $('f_' + k + '_new').value : sel).trim();
      } else if (fd[2] === 'date') {
        var d = $('f_' + k + '_d').value, t = $('f_' + k + '_t').value || '00:00', tz = $('f_' + k + '_tz').value;
        v = d ? d + ' ' + t + ':00' + (tz ? ' ' + tz : '') : '';
      } else v = $('f_' + k).value.trim();
      if (v === '') { if (k !== 'title' || key !== 'news') fm = k === 'img' ? A.fmSet(fm, k, '') : A.fmDel(fm, k); else fm = A.fmDel(fm, k); return; }
      /* inline/importance/date vanno scritti SENZA virgolette (fmSet diretto, non yq()):
         "inline: true" deve restare booleano, "importance: 2" numero, "date: 2026-09-20 14:47:00"
         un timestamp YAML che Jekyll legge come Time. Quotarli li trasformerebbe in stringhe. */
      if (k === 'inline' || k === 'importance' || k === 'date') fm = A.fmSet(fm, k, v);
      else fm = A.fmSet(fm, k, A.yq(v));
    });
    if (key === 'news' && !/^related_posts:/m.test(fm)) fm = A.fmSet(fm, 'related_posts', 'false');
    if (!name) {
      var t = $('f_title').value.trim();
      if (key === 'posts') { if (!t) return A.toast('Titolo obbligatorio', true); name = $('f_date_d').value + '-' + A.slugify(t) + '.md'; }
      else if (key === 'projects') { if (!t) return A.toast('Titolo obbligatorio', true); name = A.slugify(t) + '.md'; }
      else { return A.getDir('_news').then(function (l) { var n = 1; l.forEach(function (x) { var m = x.name.match(/announcement_(\d+)/); if (m) n = Math.max(n, +m[1] + 1); }); doPut('announcement_' + n + '.md'); }); }
    }
    return doPut(name);
    function doPut(nm) {
      var txt = '---\n' + fm.replace(/\n+$/, '') + '\n---\n\n' + $('body').value.replace(/^\n+/, '');
      return A.putFile(C[key].dir + '/' + nm, txt, cur.sha, 'admin: ' + (cur.sha ? 'aggiorna ' : 'crea ') + nm).then(function () {
        A.toast('Salvato: pubblicazione in corso'); A.go(key);
      });
    }
  });

  A.del = A.wrap(function (key, name) {
    if (!confirm('Eliminare ' + name + '?')) return;
    return A.getFile(C[key].dir + '/' + name).then(function (f) { return A.delFile(C[key].dir + '/' + name, f.sha); })
      .then(function () { A.toast('Eliminato'); A.go(key); });
  });
})(A);

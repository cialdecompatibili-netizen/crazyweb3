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
      '<button class="btn sm" onclick="mdIns(\'![\',\'](/crazyweb3/assets/img/)\')">Img</button>' +
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

  /* campi per collezione: [nome, etichetta, tipo] */
  var FIELDS = {
    posts: [['title', 'Titolo', 'text'], ['date', 'Data (YYYY-MM-DD HH:MM:SS)', 'text'], ['description', 'Descrizione', 'text'], ['tags', 'Tag (separati da spazio)', 'text'], ['categories', 'Categoria', 'text']],
    projects: [['title', 'Titolo', 'text'], ['description', 'Descrizione', 'text'], ['img', 'Immagine (es. assets/img/12.jpg)', 'text'], ['importance', 'Ordine (numero)', 'text'], ['category', 'Categoria (deve stare in display_categories di projects)', 'text'], ['redirect', 'Redirect esterno (opzionale)', 'text']],
    news: [['title', 'Titolo (solo se non inline)', 'text'], ['date', 'Data (YYYY-MM-DD HH:MM:SS -0400)', 'text'], ['inline', 'Inline (true = solo riga in home)', 'text']]
  };
  var LAYOUT = { posts: 'post', projects: 'page', news: 'post' };
  var cur = {};

  A.edit = function (key, name) {
    var p = name ? Promise.resolve(A.getFile(C[key].dir + '/' + name)) : Promise.resolve(null);
    p.then(function (f) {
      cur = { key: key, name: name || '', sha: f ? f.sha : '', fm: f ? A.splitFM(f.text).fm : '' };
      var body = f ? A.splitFM(f.text).body : '';
      var h = '<h2>' + (name ? 'Modifica ' + esc(name) : 'Nuovo in ' + C[key].label) + '</h2><div class="card">';
      FIELDS[key].forEach(function (fd) {
        var v = f ? A.fmGet(cur.fm, fd[0]) : '';
        if (!f && fd[0] === 'date') v = key === 'posts' ? A.now() : A.now() + ' +0000';
        if (!f && fd[0] === 'inline') v = 'true';
        if (!f && fd[0] === 'importance') v = '1';
        h += '<label>' + fd[1] + '</label><input id="f_' + fd[0] + '" value="' + esc(v) + '">';
      });
      h += '<label>Corpo (Markdown)</label>' + toolbar() + '<textarea id="body">' + esc(body) + '</textarea>' +
        '<p><button class="btn primary" onclick="A.save()">Salva e pubblica</button><button class="btn" onclick="A.go(\'' + key + '\')">Annulla</button></p></div>';
      M().innerHTML = h;
    }).catch(function (e) { A.toast(A.errMsg(e), true); });
  };

  A.save = A.wrap(function () {
    var key = cur.key, fm = cur.fm || 'layout: ' + LAYOUT[key], name = cur.name;
    fm = A.fmSet(fm, 'layout', LAYOUT[key]);
    FIELDS[key].forEach(function (fd) {
      var v = $('f_' + fd[0]).value.trim(), k = fd[0];
      if (v === '') { if (k !== 'title' || key !== 'news') fm = k === 'img' ? A.fmSet(fm, k, '') : A.fmDel(fm, k); else fm = A.fmDel(fm, k); return; }
      if (k === 'inline' || k === 'importance') fm = A.fmSet(fm, k, v);
      else fm = A.fmSet(fm, k, A.yq(v));
    });
    if (key === 'news' && !/^related_posts:/m.test(fm)) fm = A.fmSet(fm, 'related_posts', 'false');
    if (!name) {
      var t = $('f_title').value.trim();
      if (key === 'posts') { if (!t) return A.toast('Titolo obbligatorio', true); name = $('f_date').value.slice(0, 10) + '-' + A.slugify(t) + '.md'; }
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

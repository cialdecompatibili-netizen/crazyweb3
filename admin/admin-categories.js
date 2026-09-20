/* Categorie articoli: elenco, rinomina/unisci, elimina. Vedi claude.md.
   In Jekyll le categorie NON hanno un elenco proprio: esistono solo perche' un post le scrive nel front matter
   ('categories: a b', separate da spazio, la forma che usa questo admin). Quindi "gestirle" = riscrivere quel
   campo nei post che le usano. Le pagine archivio (/blog/category/x/) le genera jekyll-archives da sole.
   [FONTE: jekyllrb.com/docs/posts (categories) e jekyll.github.io/jekyll-archives]
   Rinomina e elimina toccano N post ma fanno UN SOLO commit (A.commitFiles) = un solo deploy, non N. */
(function (A) {
  var esc = A.esc, M = function () { return A.main(); };
  var POSTS = []; // {path, text, fm, body, cats:[...]}

  /* Legge tutti i post (N+1 chiamate, come loadCats in admin-views.js) e ne ricava le categorie. */
  function load() {
    return A.getDir('_posts').then(function (l) {
      l = l.filter(function (f) { return f.type === 'file' && /\.md$/.test(f.name); });
      return Promise.all(l.map(function (f) { return A.getFile('_posts/' + f.name).catch(function () { return null; }); }));
    }).then(function (fs) {
      POSTS = fs.filter(Boolean).map(function (f) {
        var s = A.splitFM(f.text);
        return { path: f.path, text: f.text, fm: s.fm, cats: A.fmGet(s.fm, 'categories').split(/\s+/).filter(Boolean) };
      });
    });
  }

  /* nome -> numero di post che la usano */
  function counts() {
    var c = {};
    POSTS.forEach(function (p) { p.cats.forEach(function (n) { c[n] = (c[n] || 0) + 1; }); });
    return c;
  }

  /* Riscrive 'categories:' di un post. Se non resta nessuna categoria toglie la riga (Jekyll assegna nessuna categoria). */
  function rewrite(p, cats) {
    var fm = (cats.length ? A.fmSet(p.fm, 'categories', cats.join(' ')) : A.fmDel(p.fm, 'categories')).replace(/(\r?\n)+$/, ''); // fmDel lascia un a-capo finale: senza questo resterebbe una riga vuota prima di '---'
    var eol = /\r\n/.test(p.text) ? '\r\n' : '\n';
    var body = A.splitFM(p.text).body;
    return '---' + eol + fm.replace(/\r?\n/g, eol) + eol + '---' + eol + body;
  }

  /* Un nome valido e' UNA parola (niente spazi: il campo e' separato da spazi), con caratteri semplici. */
  function clean(n) { return String(n || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''); }

  A.views.cats = function () {
    return load().then(function () {
      var c = counts(), names = Object.keys(c).sort();
      var h = '<h2>Categorie articoli</h2><div class="card"><p>Le categorie nascono quando le usi in un articolo. Qui puoi rinominarle, unirle (rinomina con il nome di un\'altra) o eliminarle da tutti gli articoli. Ogni azione e\' un solo salvataggio.</p><div class="list">';
      if (!names.length) h += '<div class="it"><span>Nessuna categoria usata.</span></div>';
      names.forEach(function (n) {
        h += '<div class="it"><span>' + esc(n) + '<small>' + c[n] + ' articol' + (c[n] === 1 ? 'o' : 'i') + '</small></span>' +
          '<button class="btn sm" onclick="A.catRen(\'' + esc(n) + '\')">Rinomina</button>' +
          '<button class="btn sm danger" onclick="A.catDel(\'' + esc(n) + '\')">Elimina</button></div>';
      });
      h += '</div></div>';
      var nocat = POSTS.filter(function (p) { return !p.cats.length; }).length;
      if (nocat) h += '<div class="card"><small>' + nocat + ' articol' + (nocat === 1 ? 'o non ha' : 'i non hanno') + ' nessuna categoria (si assegna dall\'editor dell\'articolo).</small></div>';
      M().innerHTML = h;
    });
  };

  /* Rinomina 'da' in 'a'. Se 'a' esiste gia' le due si UNISCONO (un post non ripete mai la stessa categoria due volte). */
  A.catRen = A.wrap(function (da) {
    var a = clean(prompt('Nuovo nome per "' + da + '" (una parola, senza spazi).\nSe scrivi il nome di una categoria esistente le unisci:', da));
    if (!a || a === da) return;
    var ch = [];
    POSTS.forEach(function (p) {
      if (p.cats.indexOf(da) < 0) return;
      var nc = [];
      p.cats.forEach(function (x) { x = x === da ? a : x; if (nc.indexOf(x) < 0) nc.push(x); });
      ch.push({ path: p.path, text: rewrite(p, nc) });
    });
    if (!ch.length) return;
    return A.commitFiles(ch, 'admin: categoria ' + da + ' -> ' + a).then(function () { A.toast('Rinominata in ' + a + ' (' + ch.length + ' articoli)'); A.go('cats'); });
  });

  /* Elimina 'n' da tutti i post che la usano. Gli articoli restano, perdono solo quella categoria. */
  A.catDel = A.wrap(function (n) {
    var ch = [];
    POSTS.forEach(function (p) {
      if (p.cats.indexOf(n) < 0) return;
      ch.push({ path: p.path, text: rewrite(p, p.cats.filter(function (x) { return x !== n; })) });
    });
    if (!ch.length) return;
    if (!confirm('Togliere la categoria "' + n + '" da ' + ch.length + ' articol' + (ch.length === 1 ? 'o' : 'i') + '?\nGli articoli non vengono cancellati, perdono solo questa categoria.')) return;
    return A.commitFiles(ch, 'admin: elimina categoria ' + n).then(function () { A.toast('Categoria eliminata'); A.go('cats'); });
  });
})(A);

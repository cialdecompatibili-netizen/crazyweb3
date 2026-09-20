/* Pagine + Menu/Submenu. Il menu al-folio si legge da front matter di _pages/*.md (nav, nav_order, dropdown, children). Vedi claude.md sez.4 */
(function (A) {
  var $ = A.$, esc = A.esc, M = function () { return A.main(); };
  var PG = []; // {name, sha, fm, body, title, nav, order, dropdown, permalink}

  function load() {
    return A.getDir('_pages').then(function (l) {
      l = l.filter(function (f) { return f.type === 'file' && /\.md$/.test(f.name); });
      return Promise.all(l.map(function (f) { return A.getFile('_pages/' + f.name); }));
    }).then(function (fs) {
      PG = fs.map(function (f) {
        var s = A.splitFM(f.text), fm = s.fm;
        return { name: f.path.split('/').pop(), sha: f.sha, fm: fm, body: s.body, title: A.fmGet(fm, 'title'),
          nav: A.fmGet(fm, 'nav') === 'true', order: parseFloat(A.fmGet(fm, 'nav_order')),
          dropdown: A.fmGet(fm, 'dropdown') === 'true', permalink: A.fmGet(fm, 'permalink') };
      });
      return PG;
    });
  }
  function kids(fm) { // legge children: [{title, permalink}]
    var out = [], m = fm.match(/^children:\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m);
    if (!m) return out;
    m[1].split(/\r?\n/).forEach(function (ln) {
      var t = ln.match(/^\s*-\s*title:\s*(.*)$/);
      if (t) out.push({ title: t[1].trim().replace(/^["']|["']$/g, ''), permalink: '' });
      var p = ln.match(/^\s+permalink:\s*(.*)$/);
      if (p && out.length) out[out.length - 1].permalink = p[1].trim().replace(/^["']|["']$/g, '');
    });
    return out;
  }
  function kidsYaml(arr) {
    return 'children:\n' + arr.map(function (k) {
      return k.title === 'divider' ? '  - title: divider' : '  - title: ' + A.yq(k.title) + '\n    permalink: ' + k.permalink;
    }).join('\n');
  }

  /* ---- Pagine ---- */
  A.views.pages = function () {
    return load().then(function () {
      var h = '<h2>Pagine <button class="btn primary sm" onclick="A.pgEdit()">+ Nuova</button></h2><div class="card list">';
      PG.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (p) {
        h += '<div class="it"><span>' + esc(p.title || p.name) + '<small>' + esc(p.name) + (p.nav ? ' - nel menu' : '') + '</small></span>' +
          '<button class="btn sm" onclick="A.pgEdit(\'' + esc(p.name) + '\')">Modifica</button>' +
          (p.permalink === '/' ? '' : '<button class="btn sm danger" onclick="A.pgDel(\'' + esc(p.name) + '\')">Elimina</button>') + '</div>';
      });
      M().innerHTML = h + '</div>';
    });
  };
  var curP = null;
  A.pgEdit = function (name) {
    var p = PG.filter(function (x) { return x.name === name; })[0];
    curP = p || { name: '', sha: '', fm: 'layout: page\ntitle: \npermalink: /nuova/\nnav: false', body: '' };
    var h = '<h2>' + (p ? 'Modifica ' + esc(p.name) : 'Nuova pagina') + '</h2><div class="card">' +
      (p ? '' : '<label>Nome file (senza .md)</label><input id="p_name" placeholder="chi-siamo">') +
      '<label>Front matter (YAML)</label><textarea id="p_fm" style="min-height:160px">' + esc(curP.fm) + '</textarea>' +
      '<label>Corpo (Markdown)</label><textarea id="body">' + esc(curP.body) + '</textarea>' +
      '<p><button class="btn primary" onclick="A.pgSave()">Salva e pubblica</button><button class="btn" onclick="A.go(\'pages\')">Annulla</button></p></div>';
    M().innerHTML = h;
  };
  A.pgSave = A.wrap(function () {
    var name = curP.name || (($('p_name') || {}).value || '').trim();
    if (!name) return A.toast('Nome file obbligatorio', true);
    name = A.slugify(name.replace(/\.md$/, '')).replace(/-/g, '_') === '' ? name : name.replace(/\.md$/, '');
    var txt = '---\n' + $('p_fm').value.replace(/\n+$/, '') + '\n---\n\n' + $('body').value.replace(/^\n+/, '');
    return A.putFile('_pages/' + name + '.md', txt, curP.sha, 'admin: pagina ' + name).then(function () { A.toast('Salvato'); A.go('pages'); });
  });
  A.pgDel = A.wrap(function (name) {
    if (!confirm('Eliminare ' + name + '? Controlla poi il menu.')) return;
    var p = PG.filter(function (x) { return x.name === name; })[0];
    return A.delFile('_pages/' + name, p.sha).then(function () { A.toast('Eliminato'); A.go('pages'); });
  });

  /* ---- Menu ---- */
  A.views.menu = function () {
    return load().then(function () {
      var top = PG.filter(function (p) { return p.nav; }).sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
      var home = PG.filter(function (p) { return p.permalink === '/'; })[0];
      var h = '<h2>Menu</h2><div class="card"><p>La voce Home (<b>' + esc(home ? home.title : '') + '</b>) e sempre la prima. Le altre seguono l\'ordine sotto; le pagine "Dropdown" sono submenu.</p><div id="mn">';
      top.forEach(function (p, i) {
        h += '<div class="mrow" data-n="' + esc(p.name) + '"><input class="m_t" value="' + esc(p.title) + '"><input class="m_o" type="number" value="' + (p.order || (i + 1)) + '">' +
          '<span>' + (p.dropdown ? 'Dropdown' : esc(p.permalink)) + '</span><button class="btn sm danger" onclick="A.mnOff(\'' + esc(p.name) + '\')">Togli</button></div>';
        if (p.dropdown) {
          h += '<div class="sub" data-d="' + esc(p.name) + '">';
          kids(p.fm).forEach(function (k) {
            h += '<div class="mrow k"><input class="k_t" value="' + esc(k.title) + '"><input class="k_p" value="' + esc(k.permalink) + '" placeholder="/percorso/ o https://"><span></span><button class="btn sm danger" onclick="this.parentNode.remove()">x</button></div>';
          });
          h += '<button class="btn sm" onclick="A.kAdd(this)">+ Voce submenu</button><button class="btn sm" onclick="A.kAdd(this,1)">+ Divisore</button></div>';
        }
      });
      h += '</div><p><button class="btn primary" onclick="A.mnSave()">Salva menu</button></p></div>';
      var off = PG.filter(function (p) { return !p.nav && p.permalink && p.permalink !== '/' && !/404/.test(p.permalink); });
      if (off.length) {
        h += '<div class="card"><h3>Pagine fuori dal menu</h3><div class="list">';
        off.forEach(function (p) { h += '<div class="it"><span>' + esc(p.title || p.name) + '<small>' + esc(p.permalink) + '</small></span><button class="btn sm" onclick="A.mnOn(\'' + esc(p.name) + '\')">Aggiungi al menu</button></div>'; });
        h += '</div></div>';
      }
      h += '<div class="card"><h3>Nuovo submenu</h3><p>Crea un dropdown vuoto, poi aggiungi le voci.</p><input id="dd_t" placeholder="Titolo dropdown"><p><button class="btn" onclick="A.ddNew()">Crea submenu</button></p></div>';
      M().innerHTML = h;
    });
  };
  A.kAdd = function (btn, div) {
    var d = document.createElement('div'); d.className = 'mrow k';
    d.innerHTML = div ? '<input class="k_t" value="divider" readonly><input class="k_p" value="" readonly><span></span><button class="btn sm danger" onclick="this.parentNode.remove()">x</button>'
      : '<input class="k_t" placeholder="Titolo"><input class="k_p" placeholder="/percorso/ o https://"><span></span><button class="btn sm danger" onclick="this.parentNode.remove()">x</button>';
    btn.parentNode.insertBefore(d, btn);
  };
  function setNav(name, on) {
    var p = PG.filter(function (x) { return x.name === name; })[0], fm = A.fmSet(p.fm, 'nav', on ? 'true' : 'false');
    if (on && !/^nav_order:/m.test(fm)) fm = A.fmSet(fm, 'nav_order', '20');
    if (!on) fm = A.fmDel(fm, 'nav_order');
    return A.putFile('_pages/' + name, '---\n' + fm.replace(/\n+$/, '') + '\n---\n' + (p.body.charAt(0) === '\n' ? '' : '\n') + p.body, p.sha, 'admin: menu ' + (on ? 'aggiungi ' : 'togli ') + name);
  }
  A.mnOff = A.wrap(function (n) { if (!confirm('Togliere dal menu?')) return; return setNav(n, false).then(function () { A.toast('Tolto'); A.go('menu'); }); });
  A.mnOn = A.wrap(function (n) { return setNav(n, true).then(function () { A.toast('Aggiunto (ordine 20, modificalo)'); A.go('menu'); }); });

  A.ddNew = A.wrap(function () {
    var t = ($('dd_t').value || '').trim(); if (!t) return A.toast('Titolo obbligatorio', true);
    var fm = 'layout: page\ntitle: ' + A.yq(t) + '\nnav: true\nnav_order: 20\ndropdown: true\nchildren:\n  - title: divider';
    return A.putFile('_pages/' + A.slugify(t).replace(/-/g, '_') + '.md', '---\n' + fm + '\n---\n', '', 'admin: nuovo submenu ' + t).then(function () { A.toast('Creato'); A.go('menu'); });
  });

  A.mnSave = A.wrap(function () {
    var rows = document.querySelectorAll('#mn > .mrow'), jobs = [];
    for (var i = 0; i < rows.length; i++) {
      (function (r) {
        var n = r.getAttribute('data-n'), p = PG.filter(function (x) { return x.name === n; })[0], fm = p.fm;
        fm = A.fmSet(fm, 'title', A.yq(r.querySelector('.m_t').value.trim()));
        fm = A.fmSet(fm, 'nav_order', r.querySelector('.m_o').value || '20');
        if (p.dropdown) {
          var box = document.querySelector('.sub[data-d="' + n + '"]'), ks = [];
          Array.prototype.forEach.call(box.querySelectorAll('.k'), function (k) {
            ks.push({ title: k.querySelector('.k_t').value.trim(), permalink: k.querySelector('.k_p').value.trim() });
          });
          ks = ks.filter(function (k) { return k.title === 'divider' || (k.title && k.permalink); });
          fm = fm.replace(/^children:\s*\r?\n(?:[ \t]+.*\r?\n?)*/m, '').replace(/\n+$/, '') + '\n' + kidsYaml(ks);
        }
        if (fm !== p.fm) jobs.push({ n: n, p: p, fm: fm });
      })(rows[i]);
    }
    if (!jobs.length) return A.toast('Nessuna modifica');
    return jobs.reduce(function (pr, j) {
      return pr.then(function () { return A.putFile('_pages/' + j.n, '---\n' + j.fm.replace(/\n+$/, '') + '\n---\n' + (j.p.body.charAt(0) === '\n' ? '' : '\n') + j.p.body, j.p.sha, 'admin: menu ' + j.n); });
    }, Promise.resolve()).then(function () { A.toast('Menu salvato'); A.go('menu'); });
  });
})(A);

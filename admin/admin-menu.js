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
  /* IMPORTANTE: "dropdown"/"children" NON sono documentati in al-folio docs/CUSTOMIZE.md — sono
     un meccanismo interno del layout _includes/header.liquid della gem al_folio_core (v1.x, non
     presente in questo repo perche' gem-owned: vedi claude.md sez.1 e la tabella "Where common
     files moved in v1.x" in CUSTOMIZE.md). Il comportamento qui sotto e' stato dedotto studiando
     l'output della gem installata localmente (claude.md sez.4), non dalla documentazione
     ufficiale: se in un futuro aggiornamento della gem cambia il formato di "children:", questa
     funzione va riverificata contro la gem reale, non contro questo commento.
     kids() fa un parsing MANUALE (non YAML vero) del blocco multilinea:
       children:
         - title: nome
           permalink: /path/
         - title: divider
     Funziona SOLO se il blocco resta in questa identazione esatta (2 spazi per "- title", 4 per
     "permalink", come lo scrive kidsYaml() sotto). Un utente che modifica "children:" a mano nel
     Front matter grezzo (es. dal box "Front matter (YAML)" della vista Pagine) con un'indentazione
     diversa, con "- title:" e "permalink:" sulla stessa riga, o con virgolette diverse, rompe
     silenziosamente questo parser: kids() torna un array vuoto o incompleto, senza errori. */
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
  /* kidsYaml: SCRIVE il blocco children: con l'identazione esatta che kids() sa rileggere (2 spazi per '- title', 4 per 'permalink'). Se cambi l'identazione qui devi cambiare anche il regex di kids(), e viceversa. children/dropdown: [DEDOTTO dalla gem al_folio_core, NON documentato in docs/CUSTOMIZE.md - vedi commento in cima a kids()]. Il permalink e' scritto SENZA yq(): va bene per percorsi ('/books/') e URL ('https://x.it/a', i due punti non seguiti da spazio sono validi in YAML). Rompe il YAML un permalink con ': ' (due punti + spazio) o con ' #'. Il template tratta come link esterno solo cio' che contiene '://' (header.liquid, riga con child.permalink contains '://'), tutto il resto passa da relative_url. [DEDOTTO dalla gem al_folio_core, NON documentato in CUSTOMIZE.md] */
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
    /* LAYOUT "WORDPRESS": prima quello che si scrive (Titolo + Corpo con toolbar), poi le impostazioni.
       Il front matter YAML NON sparisce: sta in <details> "Impostazioni avanzate" (chiuso), cosi' non
       copre piu' il testo. pgSave() lo legge comunque per id (p_fm), quindi nulla cambia nel salvataggio.
       Home (layout: about): 'subtitle' e le righe di 'profile.more_info' stanno nel YAML, NON nel corpo:
       per questo prima non si trovavano. Qui li mostro come campi semplici (solo se layout e' about). */
    var isAbout = A.fmGet(curP.fm, 'layout') === 'about';
    var save = '<button class="btn primary" onclick="A.pgSave()">Salva e pubblica</button><button class="btn" onclick="A.go(\'pages\')">Annulla</button>';
    var h = '<h2>' + (p ? 'Modifica ' + esc(p.name) : 'Nuova pagina') + '</h2><div class="card">' +
      '<p style="position:sticky;top:0;background:inherit;z-index:2;margin:0 0 10px">' + save + '</p>' +
      (p ? '' : '<label>Nome file (senza .md)</label><input id="p_name" placeholder="chi-siamo">') +
      '<label>Titolo</label><input id="p_title" value="' + esc(A.fmGet(curP.fm, 'title')) + '">' +
      (isAbout ? '<label>Sottotitolo (sotto il nome, accetta HTML)</label><input id="p_sub" value="' + esc(A.fmGet(curP.fm, 'subtitle')) + '">' +
        '<label>Righe sotto la foto (una per riga, senza &lt;p&gt;)</label><textarea id="p_more" style="min-height:90px">' + esc(moreInfoGet(curP.fm)) + '</textarea>' : '') +
      '<label>Corpo (Markdown)</label>' + pgToolbar() + '<textarea id="body" style="min-height:340px">' + esc(curP.body) + '</textarea><div id="mdPrev" class="mdprev" style="display:none"></div>' +
      /* SEO sotto il Corpo (stesso ordine dell'editor articoli). Solo posizione: pgSave() li legge per id. */
      '<label>SEO Title (vuoto = usa il titolo)</label><input id="p_seot" value="' + esc(A.fmGet(curP.fm, 'seo_title')) + '">' +
      '<label>SEO Description (vuoto = estratto automatico del testo)</label><input id="p_seod" value="' + esc(A.fmGet(curP.fm, 'seo_description')) + '">' +
      '<details style="margin:14px 0"><summary style="cursor:pointer;font-weight:600">Impostazioni avanzate (front matter YAML)</summary>' +
      '<p style="margin:6px 0"><small>Layout, permalink, menu, ecc. Se rompi il YAML la pagina sparisce dal sito senza errore visibile.</small></p>' +
      '<textarea id="p_fm" style="min-height:200px">' + esc(curP.fm) + '</textarea></details>' +
      '<p>' + save + '</p></div>';
    M().innerHTML = h;
  };
  /* Toolbar delle pagine: stessa dei post (window.mdIns e' definita in admin-views.js e agisce su #body).
     La duplico in piccolo qui per non dipendere dall'ordine di caricamento dei due file. */
  function pgToolbar() {
    return '<div class="tools">' +
      '<button class="btn sm" id="mdPrevBtn" onclick="mdPrev()">Anteprima</button>' +
      '<button class="btn sm" onclick="mdIns(\'**\',\'**\')"><b>B</b></button>' +
      '<button class="btn sm" onclick="mdIns(\'*\',\'*\')"><i>I</i></button>' +
      '<button class="btn sm" onclick="mdIns(\'\\n## \',\'\')">H2</button>' +
      '<button class="btn sm" onclick="mdIns(\'\\n- \',\'\')">Lista</button>' +
      '<button class="btn sm" onclick="mdIns(\'[\',\'](https://)\')">Link</button>' +
      '<button class="btn sm" onclick="mdIns(\'![\',\'](\' + A.baseurl() + \'/assets/img/)\')">Img</button></div>';
  }
  /* more_info: blocco YAML "folded" (">") con righe <p>...</p>, come in _pages/about.md. Lo mostro come
     testo semplice (una riga = un paragrafo) e lo riscrivo identico. Non e' gestito da fmGet/fmSet
     (valore multilinea, vedi commento in admin.js). Se il blocco non c'e' restituisce ''. */
  function moreInfoGet(fm) {
    var m = fm.match(/^([ \t]+)more_info:[ \t]*>[ \t]*\r?\n((?:\1[ \t]+.*\r?\n?|[ \t]*\r?\n)*)/m);
    if (!m) return '';
    return m[2].split(/\r?\n/).map(function (l) { return l.trim().replace(/^<p>/, '').replace(/<\/p>$/, ''); }).filter(Boolean).join('\n');
  }
  function moreInfoSet(fm, text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var m = fm.match(/^([ \t]+)more_info:[ \t]*>[ \t]*\r?\n((?:\1[ \t]+.*\r?\n?|[ \t]*\r?\n)*)/m);
    if (!m) return fm; /* niente blocco esistente: non invento struttura, lascio il YAML com'e' */
    var ind = m[1] + '  ';
    /* Il regex ingloba anche le righe vuote che seguono il blocco (separatore verso la chiave successiva,
       es. selected_papers). Le rimetto identiche: trovato col collaudo su about.md reale, senza questo
       ogni salvataggio toglieva la riga vuota anche a testo invariato. */
    var tail = (m[2].match(/(?:\r?\n[ \t]*)*$/) || [''])[0].replace(/^\r?\n/, '');
    var block = m[1] + 'more_info: >\n' + lines.map(function (l) { return ind + '<p>' + l + '</p>'; }).join('\n') + '\n' + tail;
    return fm.replace(m[0], function () { return block; });
  }
  /* A.pgSave: salva una pagina di _pages/. Il YAML puo' essere modificato a mano dall'utente: se lo rompe (indentazione, due punti non quotati) la pagina SPARISCE dal build, senza errore visibile. Le pagine hanno 'layout' e 'permalink' [DOC al-folio CUSTOMIZE.md: 'change the layout attribute ... and the path to access it by changing the permalink']. sha e' obbligatorio per aggiornare un file esistente (vedi putFile). Eliminare o rinominare permalink '/' rompe la home. */
  A.pgSave = A.wrap(function () {
    var name = curP.name || (($('p_name') || {}).value || '').trim();
    if (!name) return A.toast('Nome file obbligatorio', true);
    name = A.slugify(name.replace(/\.md$/, '')).replace(/-/g, '_') === '' ? name : name.replace(/\.md$/, '');
    /* SEO: i due campi (sotto il Corpo) vengono scritti DENTRO il front matter prima del salvataggio.
       Vuoto = riga rimossa (il sito usa il fallback in _includes/metadata.liquid). yq() e' obbligatorio:
       un titolo SEO con ":" o virgolette romperebbe il YAML e la pagina sparirebbe dal build. */
    var pfm = $('p_fm').value;
    /* Campi "semplici" sopra il Corpo -> riscritti nel YAML. Ordine: prima il YAML avanzato (come l'ha
       lasciato l'utente), poi sovrascrivo solo i campi che ha toccato nei box semplici.
       title/subtitle passano da yq() (un ':' li romperebbe). subtitle puo' contenere HTML (<a href=...>):
       yq lo quota, e YAML lo rilegge identico. more_info e' un blocco multilinea: moreInfoSet(). */
    if ($('p_title')) pfm = A.fmSet(pfm, 'title', A.yq($('p_title').value.trim()));
    if ($('p_sub')) { var sv = $('p_sub').value.trim(); pfm = sv ? A.fmSet(pfm, 'subtitle', A.yq(sv)) : A.fmDel(pfm, 'subtitle'); }
    if ($('p_more')) pfm = moreInfoSet(pfm, $('p_more').value);
    [['seo_title', 'p_seot'], ['seo_description', 'p_seod']].forEach(function (s) {
      var v = ($(s[1]).value || '').trim();
      pfm = v ? A.fmSet(pfm, s[0], A.yq(v)) : A.fmDel(pfm, s[0]);
    });
    var txt = '---\n' + pfm.replace(/\n+$/, '') + '\n---\n\n' + $('body').value.replace(/^\n+/, '');
    return A.putFile('_pages/' + name + '.md', txt, curP.sha, 'admin: pagina ' + name).then(function () { A.toast('Salvato'); A.go('pages'); });
  });
  /* A.pgDel: elimina il file. Effetti collaterali NON automatici: se la pagina era in un dropdown (children: di un'altra pagina) il link nel menu resta e punta a un 404; se era in nav resta il buco nell'ordine. L'admin avvisa solo con confirm(): controllare il Menu dopo. La pagina con permalink '/' (home) non ha il bottone Elimina: non rimuoverlo. */
  A.pgDel = A.wrap(function (name) {
    if (!confirm('Eliminare ' + name + '? Controlla poi il menu.')) return;
    var p = PG.filter(function (x) { return x.name === name; })[0];
    return A.delFile('_pages/' + name, p.sha).then(function () { A.toast('Eliminato'); A.go('pages'); });
  });

  /* ---- Menu ---- */
  A.views.menu = function () {
    return load().then(function () {
      var top = PG.filter(function (p) { return p.nav; }).sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
      var h = '<h2>Menu</h2><div class="card"><p>Cambia titolo e ordine delle voci (numero piu basso = piu a sinistra). Le pagine "Dropdown" sono submenu.</p><div id="mn">';
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
      var off = PG.filter(function (p) { return !p.nav && p.permalink && !/404/.test(p.permalink); });
      if (off.length) {
        h += '<div class="card"><h3>Pagine fuori dal menu</h3><div class="list">';
        off.forEach(function (p) { h += '<div class="it"><span>' + esc(p.title || p.name) + '<small>' + esc(p.permalink) + '</small></span><button class="btn sm" onclick="A.mnOn(\'' + esc(p.name) + '\')">Aggiungi al menu</button></div>'; });
        h += '</div></div>';
      }
      h += '<div class="card"><h3>Nuova voce di menu</h3><p>Crea una nuova pagina e la aggiunge subito al menu principale (non dropdown).</p><input id="mv_t" placeholder="Titolo voce"><input id="mv_p" placeholder="/percorso/ (permalink)"><p><button class="btn" onclick="A.mvNew()">Crea voce</button></p></div>';
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
  /* mnOff/mnOn: togliere/aggiungere una pagina al menu = cambiare 'nav: false/true' nel front matter [DOC al-folio: 'nav: true' nel front matter di _pages, es. bookshelf]. NON cancella la pagina: resta raggiungibile dal suo permalink. mnOn assegna nav_order 20 (finisce in fondo): [nav_order DEDOTTO dalla gem, non citato in CUSTOMIZE.md; ordine = 'sort: nav_order' in header.liquid]. */
  A.mnOff = A.wrap(function (n) { if (!confirm('Togliere dal menu?')) return; return setNav(n, false).then(function () { A.toast('Tolto'); A.go('menu'); }); });
  A.mnOn = A.wrap(function (n) { return setNav(n, true).then(function () { A.toast('Aggiunto (ordine 20, modificalo)'); A.go('menu'); }); });

  /* mvNew: crea una NUOVA pagina gia' nel menu. Il permalink deve iniziare e finire con '/' (lo forzo) e non deve gia' esistere: due pagine con lo stesso permalink si sovrascrivono in build e una sparisce. Il nome file deriva dal titolo (slugify + '_'), quindi due titoli uguali sovrascrivono lo stesso file. */
  A.mvNew = A.wrap(function () {
    var t = ($('mv_t').value || '').trim(); if (!t) return A.toast('Titolo obbligatorio', true);
    var perm = ($('mv_p').value || '').trim() || '/' + A.slugify(t) + '/';
    if (perm.charAt(0) !== '/') perm = '/' + perm;
    if (perm.charAt(perm.length - 1) !== '/') perm += '/';
    var fm = 'layout: page\ntitle: ' + A.yq(t) + '\npermalink: ' + perm + '\nnav: true\nnav_order: 20';
    return A.putFile('_pages/' + A.slugify(t).replace(/-/g, '_') + '.md', '---\n' + fm + '\n---\n', '', 'admin: nuova voce menu ' + t).then(function () { A.toast('Creata (ordine 20, modificalo)'); A.go('menu'); });
  });

  /* ddNew: crea un submenu = pagina con 'dropdown: true' + 'children:' iniziale con un solo 'divider' (deve esistere almeno la chiave children, altrimenti il template non trova la lista). [DEDOTTO dalla gem al_folio_core / header.liquid, NON documentato in CUSTOMIZE.md]. Riverificare se si aggiorna la gem. */
  A.ddNew = A.wrap(function () {
    var t = ($('dd_t').value || '').trim(); if (!t) return A.toast('Titolo obbligatorio', true);
    var fm = 'layout: page\ntitle: ' + A.yq(t) + '\nnav: true\nnav_order: 20\ndropdown: true\nchildren:\n  - title: divider';
    return A.putFile('_pages/' + A.slugify(t).replace(/-/g, '_') + '.md', '---\n' + fm + '\n---\n', '', 'admin: nuovo submenu ' + t).then(function () { A.toast('Creato'); A.go('menu'); });
  });

  /* mnSave: salva TUTTE le righe modificate del menu, una PUT per file, in SEQUENZA (reduce). Non in parallelo: ogni PUT crea un commit e due PUT simultanee sullo stesso branch danno 409. Riscrive 'children:' rimuovendo il vecchio blocco con regex e riaccodando kidsYaml(): funziona solo con l'identazione attesa (vedi kids). Salva solo i file cambiati (fm !== p.fm) per non fare commit inutili. Ogni file salvato fa partire un deploy: molti salvataggi = molti build in coda. */
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

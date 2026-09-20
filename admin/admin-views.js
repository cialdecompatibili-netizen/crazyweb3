/* Viste admin: Bacheca, Articoli, Progetti, News (lista + editor generico). Vedi claude.md */
(function (A) {
  var $ = A.$, esc = A.esc, M = function () { return A.main(); };

  /* ---- editor markdown: toolbar minima ---- */
  window.mdIns = function (a, b) {
    var t = $('body'), s = t.selectionStart, e = t.selectionEnd, v = t.value, sel = v.slice(s, e);
    t.value = v.slice(0, s) + a + sel + (b || '') + v.slice(e); t.focus();
    t.selectionStart = s + a.length; t.selectionEnd = s + a.length + sel.length;
  };
  /* ---- EDITOR VISUALE MARKDOWN (senza librerie) ------------------------------------------------
     #mdPrev e' un contenteditable: si scrive direttamente sul testo formattato. La textarea #body resta
     la fonte di verita' (il salvataggio legge $('body').value): a ogni modifica htmlToMd() la riscrive.
     Parte in VISUALE; "Sorgente" mostra il markdown grezzo.
     BLOCCHI PROTETTI: cio' che il visuale non sa modificare semanticamente (tabelle, HTML a blocchi,
     Liquid {% %} / {{ }}) diventa <div class="mdraw" data-raw="..."> con il testo ORIGINALE in un attributo,
     riscritto identico byte per byte: non si corrompe mai. Si vede la resa e con la matita si edita il sorgente.
     Liquid dentro un paragrafo = chip <span class="mdliq"> (idem: raw in data-raw).
     Il raw mostrato nel visuale e' sanificato (via <script>, on*=, javascript:): il salvato resta l'originale. */
  function safeHtml(h) {
    return String(h)
      .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
      .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  }
  function attr(s) { return esc(s); }
  function rawBlock(kind, raw) {
    var inner;
    if (kind === 'table') inner = mdTable(raw);
    else if (kind === 'html') inner = safeHtml(liqChips(raw));
    else if (kind === 'quote') inner = '<blockquote style="margin:0">' + esc(raw.replace(/^>\s?/gm, '')) + '</blockquote>';
    else if (kind === 'code' || kind === 'list') inner = '<pre style="margin:0;white-space:pre-wrap">' + esc(raw) + '</pre>';
    else inner = '<code class="mdliqb">' + esc(raw) + '</code>';
    return '<div class="mdraw mdraw-' + kind + '" data-kind="' + kind + '" data-raw="' + attr(raw) + '" contenteditable="false">' +
      '<button type="button" class="mdedit" title="Modifica sorgente del blocco" onclick="mdRawEdit(this)">&#9998;</button>' +
      '<div class="mdraw-view">' + inner + '</div></div>';
  }
  /* {% ... %} e {{ ... }} dentro l'HTML/paragrafo: chip non modificabili (raw in data-raw) */
  function liqChips(t) {
    return String(t).replace(/(\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\})/g, function (m) {
      return '<span class="mdliq" contenteditable="false" data-raw="' + attr(m) + '">' + esc(m.length > 34 ? m.slice(0, 32) + '..' : m) + '</span>';
    });
  }
  function splitRow(r) { r = r.trim().replace(/^\|/, '').replace(/\|$/, ''); return r.split(/(?<!\\)\|/).map(function (c) { return c.trim(); }); }
  function mdTable(raw) {
    var L = raw.split('\n').filter(function (x) { return x.trim(); });
    if (L.length < 2) return '<pre>' + esc(raw) + '</pre>';
    var head = splitRow(L[0]), al = splitRow(L[1]).map(function (c) { return /^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : 'left'; });
    var h = '<table><thead><tr>' + head.map(function (c, k) { return '<th style="text-align:' + (al[k] || 'left') + '">' + mdInline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    L.slice(2).forEach(function (r) { h += '<tr>' + splitRow(r).map(function (c, k) { return '<td style="text-align:' + (al[k] || 'left') + '">' + mdInline(c) + '</td>'; }).join('') + '</tr>'; });
    return h + '</tbody></table>';
  }
  function mdInline(s) {
    var keep = [];
    function K(m) { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0002'; }
    s = String(s);
    /* 1) codice inline PRIMA di tutto: dentro ai backtick non si tocca niente (tag, liquid, asterischi) */
    s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, function (m, t, c) { return K('<code data-b="' + t.length + '">' + esc(c) + '</code>'); });
    /* 2) link/immagini il cui URL o testo contiene Liquid o HTML: restano TESTO PROTETTO (chip), mai riscritti */
    s = s.replace(/!?\[[^\]]*\]\([^)]*(\{%|\{\{|<)[^)]*\)/g, function (m) { return K('<span class="mdliq" contenteditable="false" data-raw="' + attr(m) + '">' + esc(m.length > 40 ? m.slice(0, 38) + '..' : m) + '</span>'); });
    /* 3) Liquid e HTML inline restanti: chip protetti */
    s = s.replace(/(\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\})/g, function (m) { return K(liqChips(m)); });
    s = s.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/g, function (m) { return K('<span class="mdliq" contenteditable="false" data-raw="' + attr(m) + '">' + esc(m.length > 34 ? m.slice(0, 32) + '..' : m) + '</span>'); });
    s = esc(s);
    /* 4) markdown semplice */
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    /* 5) rimetto i pezzi protetti */
    for (var n = 0; n < 3 && /\u0001\d+\u0002/.test(s); n++) s = s.replace(/\u0001(\d+)\u0002/g, function (_, k) { return keep[+k]; });
    return s;
  }
  /* Un tag "blocco": elementi HTML standard di struttura + QUALSIASI custom element (nome con trattino:
     <swiper-container>, <d-article>...) + commenti/direttive. Tutto questo diventa blocco protetto. */
  var HTML_BLOCK = /^\s*(<\/?(div|section|article|aside|header|footer|nav|figure|figcaption|table|thead|tbody|tr|td|th|ul|ol|li|details|summary|iframe|video|audio|center|p|h[1-6]|pre|blockquote|hr|style|script|form|dl|dt|dd|svg|canvas|picture|source|template|main|label|select|textarea|input|button)\b|<\/?[a-z][a-z0-9]*-[a-z0-9-]*\b|<!--)/i;
  var DEPTH_TAG = /<\/?(div|section|article|aside|figure|details|table|ul|ol|blockquote|iframe|video|audio|swiper-container|swiper-slide|d-[a-z-]+|[a-z][a-z0-9]*-[a-z0-9-]+)\b[^>]*>/gi;
  function tagDepth(line) {
    var d = 0, m; DEPTH_TAG.lastIndex = 0;
    while ((m = DEPTH_TAG.exec(line))) { if (/\/>$/.test(m[0])) continue; d += /^<\//.test(m[0]) ? -1 : 1; }
    return d;
  }
  /* Blocchi che il visuale NON deve mai reinterpretare: math display $$, direttive kramdown {: ...} sole,
     definizioni footnote [^x]:, righe con indentazione di codice (4 spazi/tab), liste annidate/checkbox. */
  function isProtectedLine(l) {
    return /^\s*\$\$/.test(l) || /^\s*\{:[^}]*\}\s*$/.test(l) || /^\s*\[\^[^\]]+\]:/.test(l) ||
      /^( {4,}|\t)\S/.test(l) || /^\s+[-*+]\s/.test(l) || /^\s*[-*+]\s+\[[ xX]\]\s/.test(l) || /^\s*\d+[.)]\s+.*$/.test(l) && /^\s{2,}/.test(l);
  }
  function roundTrips(html, orig) {
    try {
      var d = document.createElement('div'); d.innerHTML = html;
      return htmlToMd(d).replace(/\n+$/, '') === String(orig).replace(/\s+$/, '');
    } catch (e) { return false; }
  }
  window.mdRender = function (src) {
    var lines = String(src || '').replace(/\r/g, '').split('\n'), out = [], i = 0, list = null, para = [];
    function flushP() {
      if (!para.length) return;
      var html = '<p>' + para.map(mdInline).join('<br>') + '</p>', orig = para.join('\n');
      if (!roundTrips(html, orig)) html = rawBlock('html', orig);   /* non torna identico -> blocco protetto */
      out.push(html); para = [];
    }
    function flushL() { if (list) { out.push('</' + list + '>'); list = null; } }
    function protect(kind, arr) { flushP(); flushL(); out.push(rawBlock(kind, arr.join('\n'))); }
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^\s*(`{3,}|~{3,})/.test(l)) {                     /* fence: SEMPRE blocco protetto; si chiude solo con >= stessi caratteri dell'apertura */
        var fm = /^\s*(`{3,}|~{3,})/.exec(l), fch = fm[1].charAt(0), fn = fm[1].length, blk = [l]; i++;
        var closeRe = new RegExp('^\\s*\\' + fch + '{' + fn + ',}\\s*$');
        while (i < lines.length && !closeRe.test(lines[i])) { blk.push(lines[i]); i++; }
        if (i < lines.length) { blk.push(lines[i]); i++; }
        protect('code', blk); continue;
      }
      if (/^\s*\$\$/.test(l)) {                               /* math display $$ ... $$ (anche su una riga) */
        var mb = [l]; var one = /^\s*\$\$[\s\S]*\$\$\s*$/.test(l) && l.trim().length > 4; i++;
        if (!one) { while (i < lines.length && !/\$\$\s*$/.test(lines[i])) { mb.push(lines[i]); i++; } if (i < lines.length) { mb.push(lines[i]); i++; } }
        protect('liquid', mb); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var tb = []; while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { tb.push(lines[i]); i++; }
        protect('table', tb); continue;
      }
      if (/^\s*\{%[^%]*%\}\s*$/.test(l) || /^\s*\{:[^}]*\}\s*$/.test(l) || /^\s*\[\^[^\]]+\]:/.test(l)) { protect('liquid', [l]); i++; continue; }
      if (HTML_BLOCK.test(l)) {                               /* HTML / custom element: fino a chiusura bilanciata + riga vuota */
        var hb = [l], depth = tagDepth(l); i++;
        while (i < lines.length && (depth > 0 || !/^\s*$/.test(lines[i]))) { hb.push(lines[i]); depth += tagDepth(lines[i]); i++; }
        protect('html', hb); continue;
      }
      if (isProtectedLine(l)) {                               /* liste annidate, checkbox, codice indentato: gruppo protetto */
        var gb = [l]; i++;
        while (i < lines.length && !/^\s*$/.test(lines[i]) && (isProtectedLine(lines[i]) || /^\s+\S/.test(lines[i]) || /^\s*[-*+]\s/.test(lines[i]) || /^\s*\d+[.)]\s/.test(lines[i]))) { gb.push(lines[i]); i++; }
        protect('list', gb); continue;
      }
      if (/^(?:[-*+]|\d+[.)])\s+/.test(l)) {                  /* gruppo di lista: guardo se ha righe indentate (sotto-liste, continuazioni) */
        var j = i + 1, nested = false;
        while (j < lines.length && !/^\s*$/.test(lines[j]) && (/^\s+\S/.test(lines[j]) || /^(?:[-*+]|\d+[.)])\s+/.test(lines[j]))) { if (/^\s+\S/.test(lines[j])) nested = true; j++; }
        if (nested) { protect('list', lines.slice(i, j)); i = j; continue; }
      }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { flushP(); flushL(); var hh = '<h' + m[1].length + '>' + mdInline(m[2]) + '</h' + m[1].length + '>'; out.push(roundTrips(hh, l) ? hh : rawBlock('html', l)); }
      else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flushP(); flushL(); out.push('<hr>'); }
      else if ((m = /^([-*+])\s+(.*)$/.exec(l))) { flushP(); if (list !== 'ul') { flushL(); out.push('<ul data-m="' + m[1] + '">'); list = 'ul'; } var lu = '<li>' + mdInline(m[2]) + '</li>'; out.push(lu); }
      else if ((m = /^(\d+)([.)])\s+(.*)$/.exec(l))) { flushP(); if (list !== 'ol') { flushL(); out.push('<ol start="' + m[1] + '" data-d="' + m[2] + '">'); list = 'ol'; } out.push('<li>' + mdInline(m[3]) + '</li>'); }
      else if (/^>/.test(l)) {
        flushP(); flushL(); var qb = [l]; while (i + 1 < lines.length && /^>/.test(lines[i + 1])) { i++; qb.push(lines[i]); }
        var qh = qb.length === 1 && /^>\s?\S/.test(qb[0]) ? '<blockquote>' + mdInline(qb[0].replace(/^>\s?/, '')) + '</blockquote>' : '';
        out.push(qh && roundTrips(qh, qb[0]) ? qh : rawBlock('quote', qb.join('\n')));
      }
      else if (/^\s*$/.test(l)) { flushP(); flushL(); }
      else { flushL(); para.push(l.replace(/\s+$/, '')); }
      i++;
    }
    flushP(); flushL();
    return out.join('\n');
  };
  /* --- HTML -> markdown (il contrario). I blocchi/chip protetti tornano al loro raw originale --- */
  function mdNode(n, ctx) {
    if (n.nodeType === 3) return n.nodeValue.replace(/\u00a0/g, ' ');
    if (n.nodeType !== 1) return '';
    var tag = n.tagName.toLowerCase(), inner = function () { return Array.prototype.map.call(n.childNodes, function (c) { return mdNode(c, ctx); }).join(''); };
    if (n.classList && n.classList.contains('mdraw')) return '\n\n' + n.getAttribute('data-raw') + '\n\n';
    if (n.classList && n.classList.contains('mdliq')) return n.getAttribute('data-raw');
    if (tag === 'button') return '';
    switch (tag) {
      case 'strong': case 'b': var a = inner(); return a.trim() ? '**' + a + '**' : a;
      case 'em': case 'i': var b = inner(); return b.trim() ? '*' + b + '*' : b;
      case 'code': if (n.parentNode && n.parentNode.tagName === 'PRE') return inner(); var bt = new Array((+n.getAttribute('data-b') || 1) + 1).join('`'); return bt + n.textContent + bt;
      case 'a': return '[' + inner() + '](' + (n.getAttribute('href') || '') + ')';
      case 'img': return '![' + (n.getAttribute('alt') || '') + '](' + (n.getAttribute('src') || '') + ')';
      case 'br': return '\n';
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        return '\n\n' + new Array(+tag[1] + 1).join('#') + ' ' + inner().replace(/\n+/g, ' ').trim() + '\n\n';
      case 'p': case 'div': return '\n\n' + inner().trim() + '\n\n';
      case 'blockquote': return '\n\n> ' + inner().trim().replace(/\n+/g, ' ') + '\n\n';
      case 'hr': return '\n\n---\n\n';
      case 'pre': return '\n\n```' + (n.getAttribute('data-lang') || '') + '\n' + n.textContent.replace(/\n+$/, '') + '\n```\n\n';
      case 'ul': case 'ol': {
        var i = 0, out = '\n\n';
        Array.prototype.forEach.call(n.children, function (li) {
          if (li.tagName.toLowerCase() !== 'li') return; i++;
          out += (tag === 'ul' ? (n.getAttribute('data-m') || '-') + ' ' : ((+n.getAttribute('start') || 1) + i - 1) + (n.getAttribute('data-d') || '.') + ' ') + mdNode(li, ctx).trim().replace(/\n+/g, ' ') + '\n';
        });
        return out + '\n';
      }
      case 'li': return inner();
      default: return inner();
    }
  }
  function htmlToMd(el) {
    var md = Array.prototype.map.call(el.childNodes, function (c) { return mdNode(c, {}); }).join('');
    return md.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '') + '\n';
  }
  function visSync() { var t = $('body'), p = $('mdPrev'); if (t && p) t.value = htmlToMd(p); }
  /* Invio dentro un titolo/citazione = paragrafo normale (come Notion/Typora) */
  function visKey(e) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    var sel = window.getSelection(); if (!sel.rangeCount) return;
    var n = sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
    while (n && n.id !== 'mdPrev') {
      if (/^(H[1-6]|BLOCKQUOTE)$/.test(n.tagName)) { e.preventDefault(); document.execCommand('insertParagraph'); document.execCommand('formatBlock', false, 'p'); return; }
      if (n.tagName === 'PRE') return;
      n = n.parentNode;
    }
  }
  function visPaste(e) {                                       /* incolla sempre testo semplice */
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  }
  /* Matita su un blocco protetto: modifica del sorgente in un mini-editor (textarea) sopra il blocco */
  window.mdRawEdit = function (btn) {
    var blk = btn.closest('.mdraw'); if (!blk) return;
    var view = blk.querySelector('.mdraw-view'), ta = blk.querySelector('textarea.mdraw-ta');
    if (!ta) {
      ta = document.createElement('textarea'); ta.className = 'mdraw-ta'; ta.value = blk.getAttribute('data-raw');
      ta.setAttribute('spellcheck', 'false'); ta.style.minHeight = Math.max(90, Math.min(360, ta.value.split('\n').length * 20 + 20)) + 'px';
      blk.appendChild(ta); view.style.display = 'none'; btn.innerHTML = '&#10003;'; btn.title = 'Applica'; ta.focus();
    } else {
      var kind = blk.getAttribute('data-kind'), tmp = document.createElement('div');
      tmp.innerHTML = rawBlock(kind, ta.value.replace(/\s+$/, ''));
      blk.parentNode.replaceChild(tmp.firstChild, blk); visSync();
    }
  };
  function visActive() { var p = $('mdPrev'); return p && p.style.display === 'block'; }
  function visOpen() {
    var t = $('body'), p = $('mdPrev'), b = $('mdPrevBtn'); if (!t || !p) return;
    p.innerHTML = window.mdRender(t.value) || '<p><br></p>';
    p.setAttribute('contenteditable', 'true'); p.setAttribute('spellcheck', 'true');
    if (!p._mdInit) { p._mdInit = 1; p.addEventListener('input', visSync); p.addEventListener('keydown', visKey); p.addEventListener('paste', visPaste); }
    p.style.minHeight = Math.max(t.offsetHeight, 240) + 'px';
    t.style.display = 'none'; p.style.display = 'block';
    if (b) { b.textContent = 'Sorgente'; b.classList.add('primary'); }
  }
  window.mdPrev = function () {                                /* toggle Visuale <-> Sorgente */
    var t = $('body'), p = $('mdPrev'), b = $('mdPrevBtn'); if (!t || !p) return;
    if (!visActive()) { visOpen(); p.focus(); }
    else { visSync(); p.style.display = 'none'; t.style.display = ''; if (b) { b.textContent = 'Visuale'; b.classList.remove('primary'); } t.focus(); }
  };
  /* all'apertura dell'editor si parte in VISUALE (chiamata da A.edit / A.pgEdit dopo aver messo il DOM) */
  window.mdStart = function () { if ($('mdPrev') && $('body')) visOpen(); };
  /* i bottoni della toolbar, in modalita' visuale, agiscono sulla selezione */
  var origIns = window.mdIns;
  window.mdIns = function (a, b) {
    if (!visActive()) return origIns(a, b);
    var p = $('mdPrev'); p.focus();
    if (a === '**') document.execCommand('bold');
    else if (a === '*') document.execCommand('italic');
    else if (/## /.test(a)) document.execCommand('formatBlock', false, 'h2');
    else if (/- /.test(a)) document.execCommand('insertUnorderedList');
    else if (a === '[') { var u = prompt('Indirizzo del link:', 'https://'); if (u) document.execCommand('createLink', false, u); }
    else if (a === '![') { var src = prompt('URL immagine:', A.baseurl() + '/assets/img/'); if (src) document.execCommand('insertImage', false, src); }
    visSync();
  };
  function toolbar() {
    return '<div class="tools">' +
      '<button class="btn sm" id="mdPrevBtn" onclick="mdPrev()">Sorgente</button>' +
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
      h += top + '<label>Corpo (Markdown)</label>' + toolbar() + '<textarea id="body">' + esc(body) + '</textarea><div id="mdPrev" class="mdprev" style="display:none"></div>' + below +
        '<p><button class="btn primary" onclick="A.save()">Salva e pubblica</button><button class="btn" onclick="A.go(\'' + key + '\')">Annulla</button></p></div>';
      M().innerHTML = h;
      window.mdStart();
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

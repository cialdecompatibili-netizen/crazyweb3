/* Immagini (assets/img/) + Impostazioni (_config.yml). Vedi claude.md */
(function (A) {
  var $ = A.$, esc = A.esc, M = function () { return A.main(); };
  var IMG = /\.(jpe?g|png|gif|webp|svg)$/i;

  A.views.media = function () {
    return A.getDir('assets/img').then(function (l) {
      var files = l.filter(function (f) { return f.type === 'file' && IMG.test(f.name); });
      var h = '<h2>Immagini</h2><div class="card"><input id="up" type="file" accept="image/*" multiple>' +
        '<p><button class="btn primary" onclick="A.upload()">Carica</button> <small>Vanno in assets/img/. Usa nei contenuti: assets/img/nome.jpg</small></p></div><div class="card"><div class="grid">';
      files.forEach(function (f) {
        h += '<div class="im"><img loading="lazy" src="' + esc(f.download_url) + '"><div>' + esc(f.name) + '</div>' +
          '<button class="btn sm" onclick="A.copyImg(\'' + esc(f.name) + '\')">Copia</button>' +
          '<button class="btn sm danger" onclick="A.delImg(\'' + esc(f.name) + '\')">x</button></div>';
      });
      M().innerHTML = h + '</div>' + (files.length ? '' : 'Nessuna immagine.') + '</div>';
    });
  };
  A.copyImg = function (n) {
    var t = 'assets/img/' + n;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { A.toast('Copiato: ' + t); });
    else A.toast(t);
  };
  A.upload = A.wrap(function () {
    var fs = $('up').files; if (!fs.length) return A.toast('Scegli un file', true);
    var arr = Array.prototype.slice.call(fs);
    return arr.reduce(function (pr, f) {
      return pr.then(function () {
        return new Promise(function (ok, ko) {
          var r = new FileReader();
          r.onload = function () { ok(r.result.split(',')[1]); }; r.onerror = ko; r.readAsDataURL(f);
        }).then(function (b64) {
          var name = f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
          return A.getFile('assets/img/' + name).then(function (ex) { return ex.sha; }, function () { return ''; })
            .then(function (sha) { return A.putFile('assets/img/' + name, b64, sha, 'admin: immagine ' + name, true); });
        });
      });
    }, Promise.resolve()).then(function () { A.toast('Caricate'); A.go('media'); });
  });
  A.delImg = A.wrap(function (n) {
    if (!confirm('Eliminare ' + n + '?')) return;
    return A.getFile('assets/img/' + n).then(function (f) { return A.delFile('assets/img/' + n, f.sha); })
      .then(function () { A.toast('Eliminata'); A.go('media'); });
  });

  /* ---- Impostazioni: solo campi semplici di _config.yml, edit chirurgico riga per riga ---- */
  var KEYS = [['title', 'Titolo sito'], ['first_name', 'Nome'], ['middle_name', 'Secondo nome'], ['last_name', 'Cognome'],
    ['contact_note', 'Nota contatti'], ['description', 'Descrizione'], ['footer_text', 'Testo footer'], ['keywords', 'Parole chiave'],
    ['lang', 'Lingua (es. it)'], ['url', 'URL sito'], ['baseurl', 'Baseurl']];
  var cfg = { sha: '', text: '' };
  function getVal(t, k) { // valore singola riga o blocco ">"
    var m = t.match(new RegExp('^' + k + ':[ \\t]*(.*)$', 'm'));
    if (!m) return '';
    var v = m[1].replace(/\s+#.*$/, '').trim();
    if (v === '>' || v === '|' || v === '>-') {
      var rest = t.slice(t.indexOf(m[0]) + m[0].length + 1).split(/\r?\n/), out = [];
      for (var i = 0; i < rest.length; i++) { if (/^\s+\S/.test(rest[i])) out.push(rest[i].trim()); else if (rest[i].trim() === '') { if (out.length) out.push(''); } else break; }
      return out.join(' ').trim();
    }
    return v.replace(/^["']|["']$/g, '');
  }
  function setVal(t, k, v) {
    var re = new RegExp('^' + k + ':[ \\t]*(.*)$', 'm'), m = t.match(re);
    if (!m) return t;
    var start = t.indexOf(m[0]), end = start + m[0].length;
    if (/^(>|\||>-)/.test(m[1].trim())) { // sostituisce anche le righe indentate del blocco
      var lines = t.slice(end + 1).split(/\r?\n/), c = 0;
      while (c < lines.length && (/^\s+\S/.test(lines[c]) || lines[c].trim() === '' && c + 1 < lines.length && /^\s+\S/.test(lines[c + 1]))) c++;
      var tail = lines.slice(c).join('\n');
      return t.slice(0, start) + k + ': >\n  ' + v + '\n' + tail;
    }
    var cm = m[1].match(/(\s+#.*)$/);
    return t.slice(0, start) + k + ': ' + (/[:#]/.test(v) && !/^https?:/.test(v) ? '"' + v.replace(/"/g, '\\"') + '"' : v) + (cm ? cm[1] : '') + t.slice(end);
  }
  A.views.settings = function () {
    return A.getFile('_config.yml').then(function (f) {
      cfg = { sha: f.sha, text: f.text };
      var h = '<h2>Impostazioni</h2><div class="card">';
      KEYS.forEach(function (k) { h += '<label>' + k[1] + ' <small>(' + k[0] + ')</small></label><input id="c_' + k[0] + '" value="' + esc(getVal(f.text, k[0])) + '">'; });
      h += '<p><button class="btn primary" onclick="A.cfgSave()">Salva</button></p><small>Attenzione: url e baseurl sbagliati rompono il sito. Modifica solo se sai cosa fai.</small></div>';
      M().innerHTML = h;
    });
  };
  A.cfgSave = A.wrap(function () {
    var t = cfg.text;
    KEYS.forEach(function (k) {
      var nv = $('c_' + k[0]).value.trim();
      if (nv !== getVal(cfg.text, k[0])) t = setVal(t, k[0], nv);
    });
    if (t === cfg.text) return A.toast('Nessuna modifica');
    return A.putFile('_config.yml', t, cfg.sha, 'admin: impostazioni').then(function () { A.toast('Salvato'); A.go('settings'); });
  });
})(A);

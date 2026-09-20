/* Moduli (sistema ad hoc "hook", stile PrestaShop/WordPress - NON e' al-folio ufficiale).
   Vedi claude.md sez. 11 e _includes/modules_hook.liquid per la logica lato tema.

   LOGICA (auto-discovery, come chiesto): l'admin NON riceve upload zip. Legge una cartella del
   repo, modules_source/<slug>/, che DEVE gia' esistere su GitHub (pushata a mano o da Claude via
   Desktop Commander): ogni sottocartella con un module.json dentro e' un modulo "disponibile".
   L'admin la mostra con un bottone Installa: copia i suoi file in _includes/modules/<slug>/ e
   assets/modules/<slug>/, scrive una riga in _data/modules_registry.yml, TUTTO IN UN SOLO COMMIT
   (A.api().commitFiles, gia' presente in admin.js per questo). Da quel momento il modulo compare
   anche fra gli "installati": attiva/disattiva/disinstalla si fanno da li'.

   STANDARD di una cartella modulo (in modules_source/<slug>/):
     module.json   OBBLIGATORIO. { "name": "...", "hooks": { "head": "head.liquid", "footer": "footer.liquid" } }
                   "hooks" e' una mappa hook -> nome file .liquid dentro la stessa cartella. Ogni
                   hook citato DEVE avere il file corrispondente, altrimenti Jekyll non trova
                   l'include e la BUILD DEL SITO FALLISCE (vedi modules_hook.liquid): l'installer
                   qui sotto lo controlla PRIMA di scrivere, e blocca con un errore chiaro.
     head.liquid, footer.liquid, ...   il codice del modulo per ciascun hook dichiarato.
     assets/...    opzionale, copiato in assets/modules/<slug>/ (immagini/css/js del modulo).
     data.yml      opzionale, copiato in _data/modules/<slug>.yml (impostazioni lette come
                   include.data nel liquid del modulo, vedi modules_hook.liquid).
   Il nome del modulo installato E' il nome della cartella (slug): due cartelle con lo stesso nome
   in modules_source non sono possibili (e' un elenco di file GitHub), quindi non serve validarlo. */
(function (A) {
  var $ = A.$, esc = A.esc;
  function M() { return A.main(); }
  var SRC = 'modules_source', REG = '_data/modules_registry.yml', INC = '_includes/modules', IMG = 'assets/modules', DATA = '_data/modules';

  /* ---- lettura registry (_data/modules_registry.yml) ----
     Il file esiste gia' (creato in sessione precedente) con una scelta migliore della mia prima
     bozza: e' un blocco JSON dentro un file .yml (JSON e' YAML valido), letto/scritto con
     JSON.parse/JSON.stringify invece di un parser riga-per-riga scritto a mano. Motivo (vedi
     commento in testa al file stesso): niente parser YAML fragile in piu' (fonte tipica di bug,
     come kids() in admin-menu.js), e il nome .yml (non .json) serve solo a far ripartire il
     deploy (deploy.yml parte su *.yml ma non su *.json soli, vedi claude.md sez. 2).
     Formato: { "installed": { "<slug>": { "name":"...", "enabled":true, "hooks":{"footer":"footer.liquid"} } } } */
  function parseRegistry(t) {
    try { var j = JSON.parse(t); return (j && j.installed) || {}; } catch (e) { return {}; }
  }
  function buildRegistry(reg) {
    return JSON.stringify({ installed: reg }, null, 2) + '\n';
  }
  function getRegistry() {
    return A.getFile(REG).then(function (f) { return { sha: f.sha, reg: parseRegistry(f.text) }; },
      function (e) { if (e.status === 404) return { sha: '', reg: {} }; throw e; });
  }

  /* ---- lettura module.json di un modulo disponibile ---- */
  function getManifest(slug) {
    return A.getFile(SRC + '/' + slug + '/module.json').then(function (f) {
      var j; try { j = JSON.parse(f.text); } catch (e) { throw new Error('module.json non valido in ' + slug); }
      if (!j.hooks || !Object.keys(j.hooks).length) throw new Error(slug + ': module.json senza "hooks"');
      return j;
    });
  }

  /* ---- vista principale ---- */
  A.views.modules = function () {
    var installed, avail;
    return getRegistry().then(function (r) {
      installed = r.reg;
      return A.getDir(SRC);
    }).then(function (l) {
      var dirs = (l || []).filter(function (f) { return f.type === 'dir'; }).map(function (f) { return f.name; });
      return dirs.reduce(function (pr, slug) {
        return pr.then(function (acc) {
          return getManifest(slug).then(function (j) { acc.push({ slug: slug, manifest: j }); return acc; }, function () { return acc; });
        });
      }, Promise.resolve([]));
    }).then(function (a) {
      avail = a;
      var h = '<h2>Moduli</h2>';
      h += '<div class="card"><small>Cartelle in <code>' + SRC + '/</code> con un <code>module.json</code> valido. ' +
        'Per aggiungerne uno nuovo, crea la cartella nel repo (vedi commento in admin-modules.js per lo standard) e ricarica questa pagina.</small></div>';

      h += '<h3>Installati</h3><div class="card list">';
      var instSlugs = Object.keys(installed);
      if (!instSlugs.length) h += '<small>Nessun modulo installato.</small>';
      instSlugs.forEach(function (s) {
        var m = installed[s];
        h += '<div class="it"><span><b>' + esc(m.name) + '</b> <small>(' + esc(s) + ', hook: ' + esc(Object.keys(m.hooks || {}).join(', ') || '-') + ')</small></span>' +
          '<small class="' + (m.enabled ? 'ok' : 'ko') + '">' + (m.enabled ? 'Attivo' : 'Disattivo') + '</small> ' +
          '<button class="btn sm" onclick="A.mdToggle(\'' + esc(s) + '\')">' + (m.enabled ? 'Disattiva' : 'Attiva') + '</button> ' +
          '<button class="btn sm danger" onclick="A.mdUninstall(\'' + esc(s) + '\')">Disinstalla</button></div>';
      });
      h += '</div>';

      h += '<h3>Disponibili</h3><div class="card list">';
      var toInstall = avail.filter(function (a) { return !installed[a.slug]; });
      if (!toInstall.length) h += '<small>Nessun modulo nuovo trovato in ' + SRC + '/.</small>';
      toInstall.forEach(function (a) {
        h += '<div class="it"><span><b>' + esc(a.manifest.name || a.slug) + '</b> <small>(' + esc(a.slug) + ', hook: ' + esc(Object.keys(a.manifest.hooks).join(', ')) + ')</small></span>' +
          '<button class="btn sm primary" onclick="A.mdInstall(\'' + esc(a.slug) + '\')">Installa</button></div>';
      });
      h += '</div>';
      M().innerHTML = h;
    });
  };

  /* ---- installazione: legge tutti i file del modulo e li scrive con UN commit (A.commitFiles) ----
     A.commitFiles (esposta da admin.js, vedi commento li' con le fonti GitHub REST) fa 1 solo
     commit per N file: o entra tutto o non entra niente. E' l'unica operazione dell'admin che
     tocca potenzialmente decine di file insieme (include + assets + registry), quindi e' anche
     l'unico posto dove l'atomicita' del commit singolo conta davvero (con putFile in sequenza,
     un errore a meta' lascerebbe il modulo mezzo copiato ma NON registrato: file orfani nel repo). */
  function listModuleFiles(slug, prefix) {
    // Elenca ricorsivamente i file sotto modules_source/<slug>/<prefix> (prefix puo' essere '').
    var base = SRC + '/' + slug + (prefix ? '/' + prefix : '');
    return A.getDir(base).then(function (l) {
      return (l || []).reduce(function (pr, f) {
        return pr.then(function (acc) {
          var rel = (prefix ? prefix + '/' : '') + f.name;
          if (f.type === 'dir') return listModuleFiles(slug, rel).then(function (sub) { return acc.concat(sub); });
          acc.push({ rel: rel, item: f }); return acc;
        });
      }, Promise.resolve([]));
    });
  }
  /* Percorso di destinazione per un file del modulo, oppure null se non va copiato (module.json). */
  function destFor(slug, rel) {
    if (rel === 'module.json') return null;
    if (rel === 'data.yml') return DATA + '/' + slug + '.yml';
    if (/^assets\//.test(rel)) return IMG + '/' + slug + '/' + rel.replace(/^assets\//, '');
    return INC + '/' + slug + '/' + rel;
  }
  /* Contenuto GitHub Contents API di un file .../contents/<path> porta gia' 'content' in base64
     (encoding:'base64'): per i binari (assets) lo si passa COSI' COM'E' a commitFiles (campo b64),
     senza decodificare/ricodificare (evita corruzione, stesso principio di A.upload in admin-media.js
     ma qui il sorgente e' gia' base64 e non un FileReader). Per il testo (liquid/json/yml) si usa il
     testo decodificato normale, che commitFiles ricodifica lui in UTF-8-safe (b64e, vedi admin.js). */
  A.mdInstall = A.wrap(function (slug) {
    var manifest;
    return getManifest(slug).then(function (j) {
      manifest = j;
      // Controllo preventivo: ogni hook deve avere il file dichiarato, altrimenti Jekyll rompe la build (vedi modules_hook.liquid).
      var missing = Object.keys(j.hooks).filter(function (h) { return !j.hooks[h]; });
      if (missing.length) throw new Error('module.json incompleto: hook senza file (' + missing.join(', ') + ')');
      return listModuleFiles(slug, '');
    }).then(function (files) {
      var relList = files.map(function (f) { return f.rel; });
      var hookFiles = Object.keys(manifest.hooks).map(function (h) { return manifest.hooks[h]; });
      var missingFiles = hookFiles.filter(function (hf) { return relList.indexOf(hf) === -1; });
      if (missingFiles.length) throw new Error('File hook mancanti in ' + slug + ': ' + missingFiles.join(', '));
      // Legge il contenuto di ogni file (in sequenza: la Contents API non offre un "get multiplo"), poi costruisce le voci per commitFiles.
      return files.reduce(function (pr, f) {
        return pr.then(function (acc) {
          var dest = destFor(slug, f.rel);
          if (!dest) return acc;
          var isAsset = /^assets\//.test(f.rel);
          return A.getFile(SRC + '/' + slug + '/' + f.rel).then(function (raw) {
            if (isAsset) acc.push({ path: dest, b64: raw.content.replace(/\n/g, '') }); // gia' base64 dalla Contents API
            else acc.push({ path: dest, text: raw.text }); // testo decodificato, commitFiles lo ricodifica
            return acc;
          });
        });
      }, Promise.resolve([]));
    }).then(function (changes) {
      return A.commitFiles(changes, 'admin: installa modulo ' + slug + ' (' + changes.length + ' file)');
    }).then(function () {
      return getRegistry();
    }).then(function (r) {
      r.reg[slug] = { name: manifest.name || slug, enabled: true, hooks: manifest.hooks };
      return A.putFile(REG, buildRegistry(r.reg), r.sha, 'admin: registra modulo ' + slug);
    }).then(function () { A.toast('Modulo installato'); A.go('modules'); });
  });

  A.mdToggle = A.wrap(function (slug) {
    return getRegistry().then(function (r) {
      if (!r.reg[slug]) throw new Error('Modulo non trovato');
      r.reg[slug].enabled = !r.reg[slug].enabled;
      return A.putFile(REG, buildRegistry(r.reg), r.sha, 'admin: ' + (r.reg[slug].enabled ? 'attiva' : 'disattiva') + ' modulo ' + slug);
    }).then(function () { A.toast('Aggiornato'); A.go('modules'); });
  });

  /* mdUninstall: toglie la riga dal registry (il modulo smette di essere agganciato). NON cancella
     i file installati (_includes/modules/<slug>/, assets/modules/<slug>/, _data/modules/<slug>.yml):
     restano nel repo, cosi' una reinstallazione e' immediata e non si perdono eventuali dati.
     Per una pulizia completa vanno cancellati a mano da GitHub (o chiedendo a Claude). */
  A.mdUninstall = A.wrap(function (slug) {
    if (!confirm('Disinstallare ' + slug + '? (i file restano nel repo, si toglie solo l\'aggancio)')) return;
    return getRegistry().then(function (r) {
      delete r.reg[slug];
      return A.putFile(REG, buildRegistry(r.reg), r.sha, 'admin: disinstalla modulo ' + slug);
    }).then(function () { A.toast('Disinstallato'); A.go('modules'); });
  });
})(A);

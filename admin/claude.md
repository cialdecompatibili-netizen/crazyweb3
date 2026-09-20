---
render_with_liquid: false
sitemap: false
---
# claude.md - Admin crazyweb3 (al-folio v1.x)

> Leggi questo file PRIMA di toccare `admin/`. Aggiornalo a fine sessione (edit chirurgici, mai riscrivere tutto).

## 0. Filosofia: zero hardcoded, tutto dinamico, sito clonabile e scalabile
Vale per **tutto il sito**, non solo per l'admin. Deve essere possibile duplicare la cartella su un nuovo repo GitHub e avere un sito funzionante toccando **solo 2 righe di config**, senza modificare codice.

**Cosa e' gia' parametrico (non toccare, e' cosi' che deve restare):**
- `url` e `baseurl` in `_config.yml`: unica fonte di verita' per hostname e sottopercorso. Tutto (footer.liquid, deploy.yml, admin) li deve leggere da li', mai duplicarli come stringa fissa altrove.
- I workflow in `.github/workflows/` usano variabili GitHub (`${{ github.repository }}` ecc.), non nomi di repo scritti a mano: restano validi su qualsiasi fork/clone.
- L'admin (`admin/*.js`) legge `REPO` dal login (localStorage) e `baseurl` da `_config.yml` via `A.baseurl()` — nessun repo o path scritto nel codice.

**Regole per ogni nuova modifica (codice sito o admin):**
- Mai scrivere in JS/HTML/CSS/Liquid nomi di repo, utenti GitHub, `baseurl`, URL assoluti del sito. Se serve un path verso il sito, costruirlo da `site.baseurl` (Liquid) o `A.baseurl()` (admin), mai concatenando una stringa fissa.
- Nessun valore di default che punti a un repo/sito specifico (niente fallback tipo `'utente/repo'`: se manca, il campo resta vuoto e lo compila l'utente).
- Prima di ogni salvataggio, cercare hardcoded residui: `Select-String -Path admin\admin*.js,_includes\*.liquid -Pattern "crazyweb3|cialdecompatibili"` (adattare il pattern al progetto) e ripulire, tranne commenti/nomi di file non funzionali.

**Procedura per clonare il sito (nuovo progetto dallo stesso template):**
1. Copiare l'intera cartella su un nuovo repo GitHub (nuovo nome).
2. In `_config.yml` aggiornare SOLO `url` (hostname) e `baseurl` (sottopercorso, es. `/nuovo-repo`), oltre ai campi anagrafici (`title`, `first_name`/`last_name`, `description`, `footer_text`).
3. Attivare GitHub Pages: source `gh-pages`, `build_type: legacy` (non `workflow`, altrimenti 404 — vedi sez. 2).
4. Primo push su `main` fa partire `deploy.yml` in automatico.
5. Aprire `admin/index.html`, fare login col nuovo `utente/repo` e un token con scope `repo`: l'admin si auto-configura, nessuna modifica al codice necessaria.
6. Se serve staccare i contenuti (post/pagine/progetti di esempio) prima di pubblicare, farlo dall'admin stesso (Pagine/Articoli) invece che a mano nel repo, cosi' resta tutto tracciato via commit.

## 0b. REGOLA OBBLIGATORIA: commentare il codice nei punti critici (in automatico, sempre)
Ogni volta che scrivi o modifichi codice in `admin/` o nei template del sito, **commenta nel codice stesso i punti critici, senza che nessuno lo chieda**. Serve perche' la sessione successiva (o un'altra chat) non ha memoria: il commento e' l'unica cosa che impedisce di rompere di nuovo quello che e' gia' stato sistemato.

**Cosa e' un "punto critico" (commento obbligatorio):**
- Un valore che NON va quotato o trasformato (es. `date`, `inline`, `importance` scritti senza virgolette).
- Codice che dipende da un formato esatto del front matter (parser manuali, regex su blocchi YAML come `children:`).
- Codice che dipende da come il tema/la gem costruisce l'HTML (es. `header.liquid`, selettori come `#back-to-top`).
- Chiamate API con vincoli nascosti (sha obbligatorio, 409 su doppio salvataggio, rate limit).
- Timing/asincronia (`BASEURL` letto dopo `start()`, finestra `t0` del deploy).
- Qualsiasi fix fatto dopo un bug: il commento dice **cosa si era rotto** e **perche' questa e' la forma giusta**.
- Override di file della gem nel repo (vedi sez. 4b): il commento in cima al file dice cosa e' cambiato rispetto all'originale.

**Come si scrive un buon commento:**
1. Dice il PERCHE', non il cosa (il cosa lo legge chiunque nel codice).
2. **FONTE DI VERITA' = SOLO la documentazione ufficiale.** Ordine: (a) al-folio: `docs/CUSTOMIZE.md` e README su github.com/alshedivat/al-folio; (b) Jekyll: jekyllrb.com/docs; (c) GitHub REST: docs.github.com. Non si cita nient'altro come "documentato": non forum, non discussioni/issue, non blog, non la memoria di una sessione precedente.
3. **Ogni commento su comportamento del tema/Jekyll/GitHub porta un'etichetta di fonte:** `[DOC al-folio]`, `[DOC Jekyll]`, `[DOC GitHub]` oppure `[DEDOTTO dalla gem, NON documentato]`. Se non e' nella doc ufficiale va SEMPRE marcato DEDOTTO e con l'istruzione "riverificare se si aggiorna la gem". Mai scrivere "documentato" per cio' che si e' solo letto nel codice della gem.
4. Dice cosa succede se qualcuno lo cambia (es. "il post sparisce da blog/home senza errori in build").
5. Un commento che descrive il comportamento VECCHIO e' peggio di nessun commento: quando cambi il codice, aggiorna o togli il commento nello stesso commit. Prima di scrivere un'affermazione, verificala sul codice (e' capitato di scrivere "va bene solo se..." su un permalink senza controllare che `kidsYaml` non usa `yq`).

**Cosa e' documentato e cosa NO (verificato sulla doc ufficiale al-folio):**
- DOCUMENTATO: pagine in `_pages` con `layout` e `permalink`; `nav: true` nel front matter per il menu; post nominati `YYYY-MM-DD-title.md`; cartella `_drafts`; workflow `schedule-posts` (23:30 UTC, disattivato di default); v1.x = starter sottile con funzionalita' nelle gem.
- NON documentato (tutto DEDOTTO dalla gem `al_folio_core-1.0.15`): `nav_order`, `dropdown`, `children`, `title: divider`, override di `_includes/header.liquid` e `_includes/metadata.liquid`. Se una futura versione della gem cambia questi meccanismi, l'admin puo' rompersi senza avviso: e' il motivo per cui ogni punto e' commentato.

**Checklist prima di ogni push (obbligatoria):**
- `node --check admin/<file>.js` su tutti i file JS toccati.
- **Controllo punti scoperti:** ogni funzione che scrive su GitHub (`putFile`, `delFile`, `A.save`, `A.pgSave`, `A.mnSave`, `A.upload`, ...), che fa parsing del front matter (`fmGet`, `fmSet`, `kids`, `kidsYaml`), che tocca date/fuso (`now`, `serverNow`) o che dipende dal template della gem DEVE avere un commento nelle righe sopra. Comando: cercare le funzioni chiave e verificare che le 4 righe precedenti contengano `/*` o `//`.
- I punti critici toccati hanno il commento aggiornato (non lasciare commenti che descrivono il comportamento vecchio).
- `git status` per vedere che non restino file modificati e non committati (e' successo: commenti scritti ma mai pushati perche' la chat si e' interrotta).
- Dopo il push, controllare che il deploy finisca in `success`.

**Perche' questa regola esiste (cronologia):** bug gia' capitati per mancanza di commenti: data quotata che faceva sparire i post; selettore del bottone torna-su sbagliato (`#vanilla-back-to-top` invece di `#back-to-top`); menu con la Home come caso speciale hardcoded nell'admin.


## 0c. DATE DEI POST e fuso orario (bug gia' capitato: post che spariscono, 404 senza errori)
**Sintomo:** un post creato dall'admin non compare in blog/home e la sua pagina da' 404, anche se il file esiste e il deploy e' `success`.
**Causa:** GitHub builda in UTC. L'admin scrive la data senza fuso (`2026-09-20 15:06:00`, ora italiana del PC). Jekyll la legge come 15:06 UTC; se l'ora UTC attuale e' precedente (in Italia e' UTC+1/+2), il post risulta nel futuro e Jekyll lo scarta silenziosamente (`future` e' false di default: jekyllrb.com/docs/configuration/options).
**Soluzione stabile (in `_config.yml`, NON nei post):**
- `timezone: Europe/Rome` -> tutte le date senza fuso sono lette come ora italiana, su qualunque PC e sul server. L'ora legale/solare la gestisce Jekyll da solo.
- `future: true` -> un post con data un po' avanti viene pubblicato lo stesso. Prezzo: niente programmazione per data futura (il workflow `schedule-posts` e' comunque disattivato).
**Regole per il codice dell'admin:**
- La data si scrive SENZA fuso e SENZA virgolette, come oggi (`admin-views.js`, funzione `save`). Non aggiungere offset presi dal browser: cambiano da PC a PC.
- Se cambi paese/fuso del sito, cambia SOLO `timezone` in `_config.yml`.
- Non rimuovere `timezone`/`future` dalla config: senza, il bug ritorna.

## 0d. SEO: seo_title e seo_description (solo questi due, volutamente semplici)
**Cosa fa:** ogni articolo, progetto, news e pagina ha due campi opzionali nell'editor admin. Compilati = usati. Vuoti = fallback automatico.
| Campo (front matter) | Se compilato | Se vuoto |
|---|---|---|
| `seo_title` | e' il `<title>` intero (senza aggiungere il nome del sito) | `titolo pagina \| titolo sito` (comportamento originale al-folio) |
| `seo_description` | e' la meta description | prima `description`, poi estratto del testo (155 caratteri), poi `description` del sito |
**Dove sta la logica:** SOLO in `_includes/metadata.liquid` (override della gem `al_folio_core-1.0.15`, variabili `seo_ttl` e `seo_desc` in cima al file). Usate in `<title>`, meta description, OpenGraph, Twitter card e schema.org: se ne tocchi una, controlla che le altre restino coerenti.
**Trappole:**
- NON usare `description` come campo SEO: in al-folio e' anche il sottotitolo VISIBILE nella pagina. Per questo esistono campi separati.
- Posizione nell'editor: SOTTO il Corpo, in quest'ordine: Tag (solo articoli), SEO Title, SEO Description. Negli articoli/progetti/news la lista e' `BELOW` in `admin-views.js`: e' solo ordine visivo, `save()` legge ogni campo per id (`f_<nome>`), quindi spostare un campo NON tocca il salvataggio. Nell'editor Pagine i due campi (`p_seot`, `p_seod`) stanno sotto il Corpo e vincono su eventuali `seo_*` scritti a mano nel YAML. Il valore passa da `A.yq()` (obbligatorio: `:` o virgolette rompono il YAML e la pagina sparisce dal build).
- Nelle collezioni i campi sono in `FIELDS` (`admin-views.js`, costante `SEO`). Vuoto = `fmDel`, la riga sparisce.
- Se aggiorni la gem: confronta `metadata.liquid` del repo con quello nuovo (`diff`), come per `header.liquid` (sez. 4b).
- Fuori scope, per scelta: anteprima Google, contatore caratteri, keyword, sitemap. Aggiungerli solo se richiesto.
- LIMITE NOTO dell'estratto automatico: parte dal markdown grezzo. I simboli `* _ # \` > [ ]` vengono tolti, ma la parte `(url)` di un link `[testo](url)` resta (Liquid non ha regex). Se una pagina inizia con un link, compilare `seo_description` a mano.
- Test locale: `bundle exec jekyll build --destination $env:TEMP\seo_test` (serve `tzinfo-data` nel Gemfile, gia' aggiunto), poi leggere `<title>` e `<meta name="description">` dell'HTML generato. Il Gemfile ha `tzinfo-data` SOLO per Windows: sul server GitHub non serve.

## 0e. OROLOGIO: l'ora dei post viene da GitHub, non dal PC (PC con l'ora sballata / piu' PC)
**Problema:** `new Date()` legge l'orologio del PC. Con ora sballata il post nasceva con data/ora sbagliata, in ordine sbagliato nel blog, e il pallino deploy non trovava la run giusta.
**Soluzione (`admin.js`):**
- `api()` legge l'header `Date` di OGNI risposta GitHub e salva `SKEW = oraServer - Date.now()`.
- `serverNow()` = `Date.now() + SKEW`: ora esatta indipendente dal PC. Fonte: GitHub, gia' in uso per tutto il resto, nessun servizio esterno in piu'.
- Il fuso e' quello del SITO: `SITE_TZ` si legge da `timezone:` in `_config.yml` (una sola fonte, sez. 0c), mai dal PC e mai scritto nel codice. `Intl.DateTimeFormat` gestisce ora legale/solare.
- `now()`/`today()` restituiscono `YYYY-MM-DD HH:MM:00` SENZA offset e SENZA virgolette (regola sez. 0c).
- `pollDeploy()` usa `serverNow()` per la finestra `t0`.
**Regole:**
- Vietato `new Date()` / `Date.now()` diretti per date scritte nei file o confrontate con timestamp GitHub: usare `serverNow()`.
- Vietato aggiungere offset (`+0000`, `+0200`) alle date: c'era nelle news, tolto. Con `timezone` in config sposterebbe l'ora di 1-2 ore.
- Se `timezone` in config e' scritto male l'admin non crasha: ripiega sul fuso del PC (i post restano leggibili, ma l'ora puo' sfasare). Controllare la config.
- Test rapido della logica: estrarre `serverNow`/`siteParts`/`now` e girarli con `node` simulando PC in ritardo/anticipo (8 casi: PC esatto, -3h, +1 giorno, inverno, mezzanotte, fuso errato, fuso vuoto).
**Limite noto:** l'ora e' corretta dalla prima chiamata API in poi. Il login ne fa diverse prima di aprire l'editor, quindi in pratica e' sempre pronta. Se GitHub non risponde con `Date` si usa l'orologio del PC.

## 1. Progetto
- Repo: `cialdecompatibili-netizen/crazyweb3` (branch `main`), sito: https://cialdecompatibili-netizen.github.io/crazyweb3/
- Base: al-folio **v1.x VERGINE** (alshedivat), tema = gem `al_folio_core` (NON e' in repo: niente _layouts/_sass).
- Locale: `C:\Users\mirco\Desktop\crazyweb3\`. Gem locale (sola lettura, per studiare): `C:\Ruby32-x64\lib\ruby\gems\3.2.0\gems\al_folio_core-1.0.15\`
- Admin: `admin/index.html` + `admin/admin.js` + `admin/admin.css`. Zero librerie, zero build. Login = token GitHub incollato dall'utente, salvato SOLO in localStorage del browser. MAI scrivere un token nel repo (pubblico).

## 2. Deploy (importante)
- Push su `main` -> workflow "Deploy site" (`deploy.yml`) builda e pubblica sul branch **gh-pages**.
- Pages: `build_type: legacy`, source `gh-pages`, path `/`. (Con `workflow` si ha 404.)
- `deploy.yml` parte solo se il push tocca: `assets/**`, `*.bib`, `*.html`, `*.js`, `*.liquid`, `**/*.md`, `**.yml`, Gemfile. Un push solo di `.css`/`.scss`/`.json` NON deploya.
- Build ~1-2 min + propagazione Pages. Dopo: ricarica forzata (Ctrl+F5).
- Verifica deploy: API `GET /repos/{o}/{r}/actions/runs` (workflow "Deploy site" -> conclusion success) poi "pages build and deployment".
- Token per API da script: sta nel remote git di `C:\Users\mirco\Desktop\crazyweb\` (`git remote get-url origin`). Il remote di crazyweb3 NON lo ha.
- `admin/claude.md` viene pubblicato online (ok, non contiene segreti). Per nasconderlo aggiungi `admin/claude.md` a `exclude:` di `_config.yml`.

## 3. Struttura contenuti (tutto e' file .md con front matter YAML)
| Sezione | Cartella | Nome file | Note |
|---|---|---|---|
| Articoli | `_posts/` | `YYYY-MM-DD-slug.md` | layout post |
| Pagine | `_pages/` | `nome.md` | menu/URL da front matter |
| Progetti | `_projects/` | `N_project.md` | griglia in /projects/ |
| News | `_news/` | `announcement_N.md` | home (about) |
| Corsi | `_teachings/` | `slug.md` | layout course |
| Libri | `_books/` | `slug.md` | layout book-review, in submenu |
| Immagini | `assets/img/` | libero | upload = PUT contents API |
| Dati | `_data/*.yml` | socials.yml, repositories.yml, cv.yml... | YAML puro |
| Impostazioni | `_config.yml` | - | title, first/middle/last_name, description, footer_text, url, baseurl |

### Front matter reali (copiati dal repo)
**Post**
```
layout: post
title: ...
date: 2015-03-15 16:40:16
description: ...
tags: formatting links        # stringa separata da spazi
categories: sample-posts
```
**Progetto**
```
layout: page
title: project 1
description: ...
img: assets/img/12.jpg       # vuoto = senza immagine
importance: 1                # ordinamento
category: work               # DEVE stare in display_categories di _pages/projects.md
redirect: https://...        # opzionale: la card porta a URL esterno
related_publications: true   # opzionale
```
**News** (`inline: true` = solo riga in home, testo = body; `inline: false` = ha pagina propria con title)
```
layout: post
title: ...                   # solo se inline: false
date: 2015-11-07 16:11:00-0400
inline: true
related_posts: false
```
**Corso** (`_teachings`): layout course, title, description, instructor, year, term, location, time, course_id, schedule[] (week/date/topic).
**Libro**: layout book-review, title, author, cover, olid, isbn, categories, tags, buy_link, date, started, finished, released, stars, goodreads_review, status.

## 4. MENU e SUBMENU (cuore dell'admin)
Il menu NON e' in un file dati: viene generato da `_includes/header.liquid` (gem) leggendo il front matter delle pagine in `_pages/`.
- Voce home (about.md, `permalink: /`): **e' una voce di menu NORMALE come tutte le altre** (vedi 4b). Ha `nav: true` + `nav_order` e si gestisce dalla lista Menu dell'admin. NON aggiungere righe speciali/hardcoded per la Home nell'admin.
- Tutte le voci: pagine con `nav: true`, ordinate per `nav_order` (numero crescente). `nav: false` (o assente) = fuori dal menu.
- **Submenu (dropdown)**: pagina con `dropdown: true` + `children:` (lista). Il `title` della pagina e' l'etichetta del dropdown; la pagina stessa NON e' cliccabile (href="#").
  ```
  layout: page
  title: submenus
  nav: true
  nav_order: 8
  dropdown: true
  children:
    - title: bookshelf
      permalink: /books/
    - title: divider          # riga separatrice
    - title: blog
      permalink: /blog/
  ```
  - `permalink` di un child puo' essere relativo (`/books/`) o esterno (contiene `://`).
  - `title: divider` = separatore (niente permalink).
  - Un child e' "active" se `page.title == child.title`.
- Voce blog: se il permalink contiene `/blog/` il link punta sempre a `/blog/`.
- Pagine con `nav: false` ma raggiungibili (es. `books.md`, `news.md`, `plugins.md`) si linkano solo da submenu o a mano.
- **`_data/navigation.yml` NON e' letto da al-folio v1**: non usarlo.
- Cambiare ordine/voci = modificare `nav`, `nav_order`, `title`, `dropdown`, `children` nel front matter dei `.md` di `_pages/`.
- Se cancelli una pagina, ricontrolla `nav_order` delle altre e i `children` del dropdown.

### 4b. Override di `_includes/header.liquid` (Home come voce normale)
Il `header.liquid` ORIGINALE della gem (`al_folio_core-1.0.15`) stampa la voce "About" scritta a mano come PRIMA voce, fuori dal ciclo ordinato per `nav_order`: per questo la Home non si poteva ne' spostare ne' togliere. Il repo ora ha una **copia locale** in `_includes/header.liquid` (Jekyll da' priorita' ai file del repo su quelli della gem) con queste differenze:
- Rimossi il ciclo che leggeva `about_title` e il blocco `<!-- About -->` hardcoded.
- Nel ciclo delle pagine, per `permalink == '/'` lo stato "active" e "(current)" usa `page.permalink == '/'` (variabile `is_active`). Senza questo, `page.url contains '/'` risulterebbe vero su TUTTE le pagine e la Home apparirebbe sempre attiva.
- `about.md` ha `nav: true` e `nav_order: 0.5` (prima di blog=1) per restare per prima come prima.
**Se aggiorni la gem** `al_folio_core`: la copia locale NON si aggiorna da sola. Confronta il `header.liquid` nuovo della gem con quello del repo (`diff`) e riporta a mano le novita' della gem, altrimenti perdi le sue correzioni.
**Se il menu perde la Home:** controlla che `_includes/header.liquid` esista nel repo e che `home.md` abbia `nav: true`.
**HOME e ABOUT sono due pagine SEPARATE (decisione di Mirco, 20/09/2026):**
- `_pages/home.md` = pagina principale, permalink `/`, voce di menu "Home" (nav_order 0.3), layout `about`.
- `_pages/about.md` = pagina "About", permalink `/about/`, voce di menu "About" (nav_order 0.5), layout `about`.
- Sono nate come copie identiche e si modificano in modo indipendente dall'admin (Pagine > Modifica). Il nome "about" e' solo il nome del LAYOUT del tema (profilo + news + ultimi post), non vuol dire "pagina Chi sono".
- REGOLA: mai due pagine con lo stesso `permalink` (Jekyll ne pubblica una sola, senza errore). Il vecchio `home.md` con permalink `/#/` era un workaround (voce di menu vuota) ed e' stato sostituito da questa.
- L'admin (A.pgDel) non da' il bottone Elimina alla pagina con permalink `/`: ora e' home.md, non about.md.

### Pagine di _pages/ (stato vergine)
| File | permalink | nav | nav_order | layout | note |
|---|---|---|---|---|---|
| about.md | `/` | (home) | - | about | profilo, subtitle, profile{}, announcements{}, latest_posts{} |
| blog.md | /blog/ | true | 1 | default | pagination{} |
| publications.md | /publications/ | true | 2 | page | da _bibliography/papers.bib |
| projects.md | /projects/ | true | 3 | page | `display_categories: [work, fun]`, `horizontal: false` |
| repositories.md | /repositories/ | true | 4 | page | dati in _data/repositories.yml |
| cv.md | /cv/ | true | 5 | cv | cv_pdf, cv_format |
| teaching.md | /teaching/ | true | 6 | page | |
| profiles.md | /people/ | true | 7 | profiles | |
| dropdown.md | (nessuno) | true | 8 | page | dropdown: true, children |
| books.md | /books/ | false | - | book-shelf | collection: books |
| news.md | /news/ | (no) | - | page | |
| plugins.md | /plugins/ | false | - | page | |
| 404.md | /404.html | - | - | page | redirect: true |
| about_einstein.md | - | - | - | - | contenuto usato da profiles.md |

Campi `about.md`: `subtitle` (HTML ok), `profile.align/image/image_circular/more_info`, `selected_papers`, `social`, `announcements.{enabled,scrollable,limit}`, `latest_posts.{enabled,scrollable,limit}`. Il corpo (bio) e' il testo sotto il front matter.

## 5. Regole tecniche al-folio v1 (trappole)
1. Layout/include/sass sono nella GEM. Nel nostro sito e' lecito fare override (shadow) ma solo se indispensabile. Override gia' presente: `_includes/footer.liquid` (bottoni flottanti, vedi sez. 7).
2. `Gemfile` e `_config.yml` devono concordare sui plugin.
3. `baseurl` = `/crazyweb3` (gia' impostato). Nell'admin costruire URL con `/crazyweb3/...`.
4. Tags nei post: stringa a spazi (`tags: a b c`). Categorie idem.
5. `_news`/`_projects`/`_teachings`/`_books` sono collezioni dichiarate in `_config.yml -> collections:` (tutte `output: true`).
6. YAML: attenzione a `:` nei titoli (quotare), date con fuso nelle news (`-0400`).
7. Non cancellare mai `about.md` (e' la home).

## 6. API GitHub usate dall'admin
- Lista cartella: `GET /repos/{repo}/contents/{path}?ref=main`
- Leggi file: idem su file -> `content` base64 (UTF-8: decodifica con `TextDecoder`), `sha`.
- Scrivi/aggiorna: `PUT /repos/{repo}/contents/{path}` body `{message, content(base64), sha?, branch:"main"}`. `sha` obbligatorio se il file esiste.
- Elimina: `DELETE` con `{message, sha, branch}`.
- Deploy status: `GET /repos/{repo}/actions/runs?branch=main&per_page=5`.
- Header: `Authorization: token <PAT>`, `Accept: application/vnd.github+json`. Scope PAT: `repo`.
- Base64 UTF-8: `btoa(unescape(encodeURIComponent(str)))` / inverso `decodeURIComponent(escape(atob(b64)))`. Immagini: base64 puro da FileReader (`readAsDataURL`, prendi dopo la virgola).
- Piu' PUT ravvicinati sullo stesso branch possono dare 409: serializzare le scritture.

## 7. Fix gia' fatti sul sito (non rifarli)
- Footer `fixed-bottom` copriva il bottone "torna su". Soluzione in `_includes/footer.liquid`: JS misura `footer.offsetHeight` -> CSS var `--footer-h`; `#back-to-top` (ID reale del bottone di vanilla-back-to-top, NON `#vanilla-back-to-top`) e `#whatsapp-demo-btn` (demo, non funzionante) posizionati con `bottom: calc(var(--footer-h) + N px)`, z-index 1031.
- Pages: sorgente `gh-pages` (non `workflow`).

## 8. Stile admin (decisioni)
- Layout responsive: sidebar scura fissa a sinistra (stile WordPress) su desktop; su mobile (<782px) sidebar nascosta + barra alta con hamburger che apre la sidebar a tendina.
- Sezioni: Bacheca, Articoli, Pagine, Menu, Progetti, News, Immagini, Impostazioni.
- Editor: textarea markdown + toolbar minima (B, I, link, H2, lista, immagine). Niente librerie.
- Ogni salvataggio = commit su main => deploy automatico. Mostrare stato deploy (polling actions/runs).
- Italiano. Messaggi di errore chiari (401 token, 404, 409 conflitto sha).

## 9. Log sessioni
- 2026-09-20: creato repo, al-folio vergine, Pages da gh-pages, fix footer/torna-su, bottone WhatsApp demo, studio docs, sviluppo admin da zero.
- 2026-09-20 (2): topbar sempre visibile su desktop (prima `display:none`) con link Sito/Deploy, testo stato e barra progresso (`.dbar`). In `admin.js`: `start()` ora valorizza `siteLink`/`deployLink` con URL reali (prima restavano `href="#"`) e chiama `lastDeploy()` invece di `pollDeploy()` all'apertura (mostra subito lo stato reale invece di una falsa animazione "in corso"). La barra parte davvero solo dopo un salvataggio (`putFile`/`delFile` chiamano `pollDeploy()`). Pushato (commit 219beb2).
- 2026-09-20 (3): aggiunta sez. 0 "zero hardcoded, tutto dinamico". Rimossi 2 hardcoded reali: fallback `REPO` in `admin.js` (era `'cialdecompatibili-netizen/crazyweb3'`, ora stringa vuota) e path fisso `/crazyweb3/assets/img/` nel bottone Img di `admin-views.js` (ora `A.baseurl()`, letto da `_config.yml` in `start()` e esposto via `A.baseurl()`).
- 2026-09-20 (4): sez. 0 estesa a tutto il sito (non solo admin): verificato che `url`/`baseurl` in `_config.yml` sono gia' l'unica fonte di verita' (workflow e footer.liquid non duplicano nulla), remote git di crazyweb3 pulito (nessun token embedded, a differenza di `crazyweb` che ce l'ha). Aggiunta procedura di clonazione in 6 passi (copia repo, 2 righe di config, Pages, push, login admin, contenuti via admin).
- 2026-09-20 (5): mancava un bottone per creare una nuova voce di menu principale (top-level, non dropdown) — c'era solo "+ Voce submenu"/"+ Divisore" dentro i dropdown e "Aggiungi al menu" per pagine gia' esistenti. Aggiunta card "Nuova voce di menu" in `A.views.menu` + funzione `A.mvNew()` in `admin-menu.js`: crea pagina nuova con `nav:true`, `nav_order:20`, permalink dato o autogenerato da slug. Pushato (commit a4aae8a).
- 2026-09-20 (6): categoria (Articoli `categories`, Progetti `category`) ora e' un dropdown (stile WordPress) invece di testo libero, per evitare doppioni tipo "Sport"/"sport". `loadCats()` in `admin-views.js` legge tutti i file della collezione e ricava i valori unici gia' usati; il dropdown li elenca + opzione "+ nuova categoria..." che mostra un input libero. Pushato (commit 95a6972).
- 2026-09-20 (7): ogni salvataggio dall'admin faceva partire ~7 workflow (CodeQL, Prettier x3, broken-links x2, star-history, integration tests...) oltre a Deploy site: sono i workflow standard del template al-folio (pensati per chi sviluppa il tema stesso o siti accademici con CV/citazioni), inutili per un sito gestito solo dall'admin. Disattivati 21 dei 22 file in `.github/workflows/` rinominandoli `.yml.disabled` (GitHub li ignora, reversibile rinominando in `.yml`). Attivo solo `deploy.yml`. Pushato (commit d69b663). **Se si clona il sito: questa disattivazione si eredita col repo, nessuna azione richiesta.**
- 2026-09-20 (8): BUG trovato e fisso: in `A.save()` di `admin-views.js`, il campo `date` (posts/news) passava per `A.yq()` come tutti gli altri campi testo, che lo quota se contiene spazi (`date: "2026-09-20 14:47:00"`). Una data quotata e' una stringa YAML per Jekyll, non un valore data: puo' rompere ordinamento cronologico e la regola `future: false` (default Jekyll, nessun `future:` in `_config.yml`) puo' escludere il post dalla build se il confronto data avviene in UTC (build gira su GitHub Actions, non ora locale). Fix: `date` ora passa non quotata come `inline`/`importance`. Pushato (commit a0156b0). **Da rifare a mano sui post gia' creati con la data quotata** (aprirli in admin e risalvare, oppure editarli su GitHub togliendo le virgolette da `date:`).
- 2026-09-20 (9): risolto alla radice il rischio "data scritta male" (come WordPress: niente testo libero). Il campo Data (posts/news) e' ora `dateField()`: `<input type="date">` + `<input type="time">` nativi del browser (calendario/orologio grafico) invece di un `<input type="text">` dove si poteva digitare qualsiasi formato. `parseDate()` scompone il valore YAML esistente in aprire-modifica; `A.save()` lo ricompone sempre nel formato corretto `YYYY-MM-DD HH:MM:SS[ +ZZZZ]`, non quotato. Corretta anche a mano la data gia' quotata di `_posts/2026-09-20-nuovo-post-prova.md`. Pushato (commit 3ec8a40).

## 11. Sistema MODULI (hook stile PrestaShop, NON e' al-folio ufficiale)
Aggiunto per estendere il sito senza toccare il tema. Verificato che al-folio v1.x ha un proprio
"plugin ecosystem" ma sono gem Ruby wired in Gemfile/_config.yml [DOC al-folio, docs/CUSTOMIZE.md
sez. "Plugin ecosystem (v1.x)"]: e' un concetto diverso, non applicabile a runtime da admin senza
build locale. Questo sistema e' quindi COSTRUITO SU MISURA, non un pattern al-folio.

**Logica (auto-discovery):** una cartella in `modules_source/<slug>/` col suo `module.json` (nel
repo, pushata a mano o da Claude) e' un modulo "disponibile". L'admin (sezione Moduli) la legge via
GitHub API e mostra un bottone Installa: copia i file nei posti giusti e scrive il registry, in UN
commit atomico (`A.commitFiles`). Da li' si Attiva/Disattiva/Disinstalla senza toccare codice.

**File coinvolti:**
- `_includes/modules_hook.liquid`: stampa, per l'hook richiesto (`head`|`footer`), l'include di ogni
  modulo installato e attivo. Chiamato da `_includes/metadata.liquid` (hook='head') e
  `_includes/footer.liquid` (hook='footer'). Sintassi: tag include con nome file da variabile (parola chiave include, poi variabile tra doppie graffe), verificata su
  [DOC Jekyll, jekyllrb.com/docs/includes, sez. "Using variables names for the include file"].
- `_data/modules_registry.yml`: JSON dentro un file .yml (deciso in sessione precedente, migliore
  di un parser YAML a mano): `{ "installed": { "<slug>": {name,enabled,hooks{}} } }`. Il nome .yml
  (non .json) serve a far ripartire deploy.yml (parte su *.yml, non su *.json soli, vedi sez. 2).
- `_data/modules/<slug>.yml`: dati/impostazioni opzionali del singolo modulo, letti da Jekyll come
  `site.data.modules.<slug>` [DOC Jekyll, jekyllrb.com/docs/datafiles: le sottocartelle di _data
  diventano namespace annidati in site.data].
- `admin/admin-modules.js`: vista "Moduli", install/toggle/uninstall.
- `modules_source/<slug>/`: sorgente dei moduli disponibili (module.json + file per hook + assets/
  + data.yml opzionali). Presente un modulo di esempio, `esempio-banner`.

**Standard di un modulo** (in `modules_source/<slug>/`):
```
module.json   { "name": "...", "hooks": { "head": "head.liquid", "footer": "footer.liquid" } }
head.liquid, footer.liquid, ...   codice Liquid per ogni hook dichiarato (obbligatori se citati)
assets/...    opzionale -> installato in assets/modules/<slug>/
data.yml      opzionale -> installato in _data/modules/<slug>.yml
```
Il modulo nel suo liquid riceve `include.slug`, `include.assets_url` (con baseurl gia' applicato),
`include.data` (contenuto di data.yml, puo' essere vuoto).

**Punti critici (da rileggere prima di toccare questi file):**
- Se un hook dichiarato in module.json non ha il file corrispondente: Jekyll fallisce l'intera
  build ("Could not locate the included file"). `A.mdInstall` controlla PRIMA di scrivere.
  Se succede lo stesso (file cancellato a mano dal repo): Moduli > Disattiva/Disinstalla, i commit
  funzionano anche a build rotta (non serve un deploy che passi per editare il registry).
- Installazione = 1 solo commit (`A.commitFiles`, esposta da admin.js in `api_` apposta per questo):
  se andasse a meta' con putFile in sequenza, resterebbero file orfani copiati ma non registrati.
- Asset binari: passati a commitFiles col campo `b64` gia' cosi' come arrivano dalla Contents API
  (che li restituisce gia' in base64), MAI decodificati/ricodificati (rischio corruzione, stesso
  principio di A.upload in admin-media.js).
- Disinstallare toglie solo la riga dal registry (il modulo smette di essere agganciato): i file
  restano nel repo apposta, per permettere reinstallazione immediata senza perdita dati.
- `SRC`/`REG`/`INC`/`IMG`/`DATA` in admin-modules.js sono percorsi FISSI del sistema moduli stesso
  (non baseurl/repo dell'utente): non violano la regola zero-hardcoded di sez. 0, sono lo standard
  della funzionalita', come '_posts/' lo e' per gli articoli.

**Log:** 2026-09-20: creato modules_hook.liquid, aggancio in metadata.liquid (head, gia' presente)
e footer.liquid (footer, aggiunto ora), admin-modules.js (vista + install/toggle/uninstall atomico
via commitFiles, esposta da admin.js), voce sidebar "Moduli", modulo di esempio esempio-banner.
Verificato su documentazione ufficiale (al-folio CUSTOMIZE.md plugin ecosystem, Jekyll includes con
variabili, Jekyll data files con sottocartelle). Pushato (commit 752dd08, dopo rebase su a2e33f9).

## 10. Prossimi step / idee
- Sezione Corsi (`_teachings`) e Libri (`_books`) se servono.
- Editor `_data/socials.yml` (email, scholar, whatsapp_number...).
- Rendere attivo il bottone WhatsApp (link `https://wa.me/<numero>`), usando `whatsapp_number` di socials.yml.
- Anteprima markdown (opzionale, leggera).

### 11b. REGOLA UNIVERSALE "Configura" (vale per OGNI modulo, presente e futuro)
Sessione 2026-09-20. Il bottone **Configura esiste SEMPRE** per ogni modulo installato, senza condizioni
(prima compariva solo con `config_fields` nel manifest: un modulo senza campi sembrava non configurabile).
La pagina Configura (`A.views.mdconfig` in `admin-modules.js`) e' identica per tutti e mostra, in ordine:
1. **Info** (sempre): slug, stato, hook.
2. **Indirizzi pubblici** (se il modulo ha `roots`, cioe' file in radice come `sitemap.xml`): URL completo + Copia + Apri.
3. **Form** (se ha `config_fields`): un campo per voce. Tipi: `text`, `textarea`, `checkbox`, `image`.
4. Se non ha ne' roots ne' campi: messaggio "nessuna impostazione", mai pagina vuota.
Dove finiscono i valori: `_data/modules/<slug>.yml`, piatto, una riga per campo. Il modulo li legge come `include.data.<key>` (hook) o `site.data.modules.<slug>.<key>` (file root/).
**A capo nei valori** (textarea): salvati come `\n` dentro virgolette doppie e ripristinati in lettura; nel Liquid si spezza con il filtro split sul carattere a-capo. Testato con backslash, virgolette, `:` e `#`.
**Trappola registry:** `config_fields` e `roots` vengono copiati nel registry (`_data/modules_registry.yml`) all'INSTALLAZIONE. Un modulo installato prima di aggiungere `config_fields` al suo manifest non li ha: bisogna disinstallare e reinstallare, oppure aggiornare a mano la voce nel registry.
**Trappola sitemap:** `site.documents` contiene anche i post, quindi va saltata la collezione `posts` (gia' coperta da `site.posts`) o ogni articolo compare 2 volte.
Se scrivi un nuovo modulo: dichiara i campi in `config_fields` del `module.json` e leggili col default `| default:` nel template, cosi' funziona anche prima del primo salvataggio.
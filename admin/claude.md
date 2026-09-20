# claude.md - Admin crazyweb3 (al-folio v1.x)

> Leggi questo file PRIMA di toccare `admin/`. Aggiornalo a fine sessione (edit chirurgici, mai riscrivere tutto).

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
- Voce home: la pagina con `permalink: /` (about.md), il testo del link e' il suo `title`.
- Altre voci: tutte le pagine con `nav: true`, ordinate per `nav_order` (numero crescente). `nav: false` (o assente) = fuori dal menu.
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

## 10. Prossimi step / idee
- Sezione Corsi (`_teachings`) e Libri (`_books`) se servono.
- Editor `_data/socials.yml` (email, scholar, whatsapp_number...).
- Rendere attivo il bottone WhatsApp (link `https://wa.me/<numero>`), usando `whatsapp_number` di socials.yml.
- Anteprima markdown (opzionale, leggera).

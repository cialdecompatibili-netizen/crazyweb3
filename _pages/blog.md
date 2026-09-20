---
layout: default
permalink: /blog/
title: Blog
nav: true
nav_order: 0.4
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 5
  sort_field: date
  sort_reverse: true
  trail:
    before: 1 # The number of links before the current page
    after: 3 # The number of links after the current page
---

<div class="post">

{% comment %}
  ELENCO CATEGORIE del blog, in cima e il piu' compatto possibile (il lettore vuole subito le informazioni).
  - Niente titolo del blog (blog_name in _config.yml NON e' piu' usato in questa pagina).
  - DESCRIZIONE OPZIONALE: se scrivi qualcosa in blog_description (_config.yml) compare in una riga piccola sopra le categorie;
    se e' vuota (blank) non viene generato NESSUN elemento, quindi non occupa spazio. Oggi e' vuota.
  - Mostra SEMPRE TUTTE le categorie che esistono nei post (site.categories), in ordine alfabetico, ognuna con il
    numero di post, senza limite e senza taglio. Il link va all'archivio di jekyll-archives (/blog/category/nome/).
  - Per aggiungere una categoria basta usarla in un post: compare da sola. I tag NON sono in questa barra
    (restano sotto ogni post, cliccabili).
  - CSS (l'unico di questa pagina): righe di testo piccolo, separatore "·" con margini minimi, niente icone,
    Per stringere o allargare basta cambiare font-size / gap / margin qui sotto.
  - SPAZIO SOPRA: il tema mette 3rem (classe mt-5) sopra il contenuto; qui lo azzero solo per questa pagina
    (regola .container.mt-5:has(...)), cosi' la lista sta a 1cm dalla riga del menu = il primo valore di "margin: 1cm 0 .5cm".
    Cambia solo quel "1cm" (0.5cm piu stretto, 1.5cm piu largo). Il secondo valore (.5cm) e' lo spazio sotto la lista.
  - NESSUNA RIGA ORIZZONTALE sotto le card in evidenza (tolto il tag hr).
  - I margini stretti valgono solo per questa pagina: usano selettori .post e .tag-category-list, non toccano il tema.
{% endcomment %}
<style>
  .container.mt-5:has(> .post > .tag-category-list) { margin-top: 0 !important; }
  .post > .tag-category-list { margin: 1cm 0 .5cm; line-height: 1.25; font-size: .85rem; text-align: center; }
  .post > .tag-category-list ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 0 .35rem; list-style: none; padding: 0; margin: 0; }
  .post > .tag-category-list li { margin: 0; padding: 0; }
  .post > .blog-desc { margin: 0 0 .25rem; line-height: 1.25; font-size: .85rem; text-align: center; color: var(--global-text-color-light); }
  .post .featured-posts .mb-4 { margin-bottom: .5rem !important; }
  .post > .tag-category-list li + li::before { content: "\00b7"; margin-right: .35rem; color: var(--global-text-color-light); }
</style>
{% assign blog_desc = site.blog_description | strip %}
{% if blog_desc != "" %}<p class="blog-desc">{{ blog_desc }}</p>{% endif %}
{% if site.categories.size > 0 %}
  <div class="tag-category-list">
    <ul>
      {% assign cats_sorted = site.categories | sort %}
      {% for c in cats_sorted %}
        <li><a href="{{ c[0] | slugify | prepend: '/blog/category/' | relative_url }}">{{ c[0] }}</a> ({{ c[1] | size }})</li>
      {% endfor %}
    </ul>
  </div>
{% endif %}

{% assign featured_posts = site.posts | where: "featured", "true" %}
{% if featured_posts.size > 0 %}

<div class="container featured-posts">
{% assign is_even = featured_posts.size | modulo: 2 %}
<div class="row row-cols-{% if featured_posts.size <= 2 or is_even == 0 %}2{% else %}3{% endif %}">
{% for post in featured_posts %}
<div class="col mb-4">
<a href="{{ post.url | relative_url }}">
<div class="card hoverable">
<div class="row g-0">
<div class="col-md-12">
<div class="card-body">
<div class="float-right">
<i class="fa-solid fa-thumbtack fa-xs"></i>
</div>
<h3 class="card-title text-lowercase">{{ post.title }}</h3>
<p class="card-text">{{ post.description }}</p>

                    {% if post.external_source == blank %}
                      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
                    {% else %}
                      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
                    {% endif %}
                    {% assign year = post.date | date: "%Y" %}

                    <p class="post-meta">
                      {{ read_time }} min read &nbsp; &middot; &nbsp;
                      <a href="{{ year | prepend: '/blog/' | relative_url }}">
                        <i class="fa-solid fa-calendar fa-sm"></i> {{ year }} </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </div>
      {% endfor %}
      </div>
    </div>

{% endif %}

  <ul class="post-list">

    {% if page.pagination.enabled %}
      {% assign postlist = paginator.posts %}
    {% else %}
      {% assign postlist = site.posts %}
    {% endif %}

    {% for post in postlist %}

    {% if post.external_source == blank %}
      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
    {% else %}
      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
    {% endif %}
    {% assign year = post.date | date: "%Y" %}
    {% assign tags = post.tags | join: "" %}
    {% assign categories = post.categories | join: "" %}

    <li>

{% if post.thumbnail %}

<div class="row">
          <div class="col-sm-9">
{% endif %}
        <h3>
        {% if post.redirect == blank %}
          <a class="post-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
        {% elsif post.redirect contains '://' %}
          <a class="post-title" href="{{ post.redirect }}" target="_blank">{{ post.title }}</a>
          <svg width="2rem" height="2rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="#999" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        {% else %}
          <a class="post-title" href="{{ post.redirect | relative_url }}">{{ post.title }}</a>
        {% endif %}
      </h3>
      <p>{{ post.description }}</p>
      <p class="post-meta">
        {{ read_time }} min read &nbsp; &middot; &nbsp;
        {{ post.date | date: '%B %d, %Y' }}
        {% if post.external_source %}
        &nbsp; &middot; &nbsp; {{ post.external_source }}
        {% endif %}
      </p>
      <p class="post-tags">
        <a href="{{ year | prepend: '/blog/' | relative_url }}">
          <i class="fa-solid fa-calendar fa-sm"></i> {{ year }} </a>

          {% if tags != "" %}
          &nbsp; &middot; &nbsp;
            {% for tag in post.tags %}
            <a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">
              <i class="fa-solid fa-hashtag fa-sm"></i> {{ tag }}</a>
              {% unless forloop.last %}
                &nbsp;
              {% endunless %}
              {% endfor %}
          {% endif %}

          {% if categories != "" %}
          &nbsp; &middot; &nbsp;
            {% for category in post.categories %}
            <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">
              <i class="fa-solid fa-tag fa-sm"></i> {{ category }}</a>
              {% unless forloop.last %}
                &nbsp;
              {% endunless %}
              {% endfor %}
          {% endif %}
    </p>

{% if post.thumbnail %}

</div>

  <div class="col-sm-3">
    <img class="card-img" src="{{ post.thumbnail | relative_url }}" style="object-fit: cover; height: 90%" alt="image">
  </div>
</div>
{% endif %}
    </li>

    {% endfor %}

  </ul>

{% if page.pagination.enabled %}
{% include pagination.liquid %}
{% endif %}

</div>

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

{% assign blog_name_size = site.blog_name | size %}
{% assign blog_description_size = site.blog_description | size %}

{% if blog_name_size > 0 or blog_description_size > 0 %}

  <div class="header-bar">
    <h1>{{ site.blog_name }}</h1>
    <h2>{{ site.blog_description }}</h2>
  </div>
  {% endif %}

{% comment %}
  Barra categorie + tag AUTOMATICA (prima le categorie, poi i tag): legge tutti i post, non serve piu' mantenere
  display_tags / display_categories in _config.yml. I tag sono ordinati per numero di post e limitati a
  'blog_max_tags' (default 12) e le categorie a 'blog_max_categories' (default 4), sempre le piu' usate per prime.
  I link puntano agli archivi di jekyll-archives (/blog/tag/x/, /blog/category/x/), generati per ogni valore.
{% endcomment %}
{% assign max_tags = site.blog_max_tags | default: 12 %}
{% assign max_cats = site.blog_max_categories | default: 4 %}
{% comment %} site.categories / site.tags sono mappe nome -> array di post: non si ordinano con "sort".
  Costruisco stringhe "0007|nome" (conteggio a 4 cifre) e le ordino come testo, poi le rovescio. {% endcomment %}
{% assign cat_keys = "" | split: "" %}
{% for c in site.categories %}
  {% assign n = c[1] | size %}
  {% assign key = n | prepend: "0000" | slice: -4, 4 | append: "|" | append: c[0] %}
  {% assign cat_keys = cat_keys | push: key %}
{% endfor %}
{% assign cat_list = cat_keys | sort | reverse %}
{% assign tag_keys = "" | split: "" %}
{% for t in site.tags %}
  {% assign n = t[1] | size %}
  {% assign key = n | prepend: "0000" | slice: -4, 4 | append: "|" | append: t[0] %}
  {% assign tag_keys = tag_keys | push: key %}
{% endfor %}
{% assign tag_list = tag_keys | sort | reverse %}

{% if cat_list.size > 0 or tag_list.size > 0 %}

  <style>
    /* Barra categorie/tag limitata a 2 righe: il taglio segue la larghezza (su mobile entrano meno voci). */
    .tag-category-list ul { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; line-height: 1.6em; max-height: 3.2em; overflow: hidden; }
    .tag-category-list ul li, .tag-category-list ul p { margin: 0; }
    /* Schermi piccoli: meno voci (restano le piu' usate, l'ordine e' gia' per numero di post) cosi' non si taglia a meta'. */
    @media (max-width: 768px) {
      .tag-category-list ul { font-size: .9em; }
      .tag-category-list ul li:nth-of-type(n+9), .tag-category-list ul li:nth-of-type(n+9) + p { display: none; }
    }
  </style>
  <div class="tag-category-list">
    <ul class="p-0 m-0">
      {% for item in cat_list limit: max_cats %}
        {% assign category = item | split: "|" | slice: 1, 99 | join: "|" %}
        <li>
          <i class="fa-solid fa-tag fa-sm"></i> <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">{{ category }}</a>
        </li>
        {% unless forloop.last %}
          <p>&bull;</p>
        {% endunless %}
      {% endfor %}
      {% if cat_list.size > 0 and tag_list.size > 0 %}
        <p>&bull;</p>
      {% endif %}
      {% for item in tag_list limit: max_tags %}
        {% assign tag = item | split: "|" | slice: 1, 99 | join: "|" %}
        <li>
          <i class="fa-solid fa-hashtag fa-sm"></i> <a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">{{ tag }}</a>
        </li>
        {% unless forloop.last %}
          <p>&bull;</p>
        {% endunless %}
      {% endfor %}
    </ul>
  </div>
  {% endif %}

{% assign featured_posts = site.posts | where: "featured", "true" %}
{% if featured_posts.size > 0 %}
<br>

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
    <hr>

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

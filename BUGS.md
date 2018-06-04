# BUG
Error Tutorial on [**"Creating filter UI with apostrophe-pieces-pages"**](https://apostrophecms.org/docs/tutorials/intermediate/cursors.html#creating-filter-u-i-with-code-apostrophe-pieces-pages-code) from the code :

```html
{# Link to all the tags, adding a parameter to the query string #}
<ul class="tag-filters">
  {% for tag in data.piecesFilters.tags %}
    <li><a href="{{ data._url | build({ tags: tag.value }) }}">{{ tag.label }}</a></li>
  {% endfor %}
</ul>
```

> Fixed from `data._url` to `data.url`
---
"@apostrophecms/apostrophe-astro": patch
---

Query string parameters are no longer lost when a URL with a trailing slash is normalized, so `/articles/?page=2` now renders the same content as `/articles?page=2`. Previously such URLs were redirected to the page URL alone (e.g. `/articles`), losing the query string and showing the first page. Redirects to a different origin are now always passed through to the browser.

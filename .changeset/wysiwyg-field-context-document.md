---
"apostrophe": patch
---

Fields rendered in place, by the `{% field %}` tag or for an external front such as Astro, now carry the editor only for the document the page is actually about — the piece of a show page, otherwise the page itself, which is the document the admin bar takes as its context. Everything else a page renders is there to be read and is edited on its own page: the fifty pieces of an index page, the home page and the ancestors and children behind the navigation, the global doc. Each of those was sent a document id, a patch key, a field id, the name of an editor component, its icon and a second copy of its own value, for an editor the browser then declined to mount, on every page, for every field. They are now emitted as the value in the tag and with the classes the field type asked for, and nothing else. A request that is about no page at all, as when the area editor asks for fresh markup for a single widget, rules out nothing.

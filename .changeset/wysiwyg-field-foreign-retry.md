---
"apostrophe": patch
---

Fixed fields rendered by the `{% field %}` tag becoming permanently uneditable for the life of a page load, while every area on the same page stayed editable. A field is not editable in place when it belongs to a document other than the one being edited, which the browser decides by comparing the element's document id against the admin bar's context id. That comparison was made once, and the element was struck off the list of candidates before the comparison was made, so a pass that ran while the two legitimately disagreed — as they do briefly when the context bar restores the draft mode it remembers for the tab after the page has already rendered in the other mode — left the field inert until the next full navigation. A field judged to belong to another document now stays a candidate, so a later pass reconsiders it once the context has settled, in the same spirit as an area recomputing whether it is foreign rather than settling the question once.

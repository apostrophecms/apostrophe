---
"apostrophe": patch
---

Security: widget style values were written into the generated wrapper's `style` and `class` attributes without HTML attribute escaping, so a project-defined free-form `string` style field could be used by an editor to inject additional HTML attributes into the published page. All attribute values rendered by `getWidgetAttributes()` and the `apos.styles.attributes()` helper are now escaped. Only projects that define a free-form style field are affected, and exploitation requires permission to edit the widget (CWE-79, CWE-116, GHSA-7jg5-frgc-c67w).

Thanks to [Fariskhi Vidyan](https://github.com/farisv) for reporting the vulnerability.

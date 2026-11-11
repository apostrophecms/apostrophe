---
"apostrophe": patch
---

Security: query parameter names were checked against the list of query builders with a lookup that treats dots as a property path, so names such as `sort.launder` passed the check and then caused an uncaught error. Any visitor could trigger a 500 response and a stack trace in the server log on every request to the public REST API of a piece type with `publicApiProjection` set, the search page and piece index pages. The same flaw affected the `choices` query parameter, the `apiKeys` check (which required a valid key name) and `apos.util.orderById`. These checks now use an own-property lookup, so such names are ignored or rejected. The process did not crash and no data was exposed (CWE-248, CWE-400, GHSA-w4qx-qgqh-6qm5).

Thanks to [hackeronerishithehacker-dev](https://github.com/hackeronerishithehacker-dev) for reporting the vulnerability.

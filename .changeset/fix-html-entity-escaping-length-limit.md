---
"sanitize-html": patch
---

With `parser.decodeEntities: false`, named entities longer than 20 characters, such as `&CounterClockwiseContourIntegral;`, are no longer double-encoded.

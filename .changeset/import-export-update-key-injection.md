---
"@apostrophecms/import-export": patch
---

Security: when importing with a `:key` column to update existing documents, the key column's name and value were used as-is in the database query that finds the document to update. Because gzip archives are parsed with EJSON and CSV cells are JSON-parsed, a crafted file could supply a MongoDB query operator instead of a plain value (or an operator such as `$where` as the column name) and overwrite existing documents it never actually identified. Key values must now be plain strings or numbers and key column names may not start with `$` or contain `.`; rows that break these rules are reported as failed and nothing is updated or inserted for them (CWE-943, CWE-284, GHSA-jqw5-w6h3-44g6).

Thanks to [carfeii](https://github.com/carfeii) for reporting the vulnerability and proposing a fix, and to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for independently reporting it via CSV import.

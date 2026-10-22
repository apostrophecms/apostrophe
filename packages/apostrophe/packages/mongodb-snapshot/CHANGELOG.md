# Changelog

## 1.1.0 (2025-01-22)

* Added `--exclude=name1,name2...` option for excluding entire collections in either command, with a similar feature in the API.
* Added `--filter-name1='{ mongodb criteria here }'` option for filtering the documents in a specific collection in the `mongodb-snapshot-write` command, with a similar feature in the API. Note that the collection name is given after `--filter-` as part of the parameter name.

## 1.0.0 (2025-01-22)

* Initial release.

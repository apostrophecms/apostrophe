# @apostrophecms/db-connect

## 1.0.2 (2026-09-03)

### Fixes

- Fixed the sqlite adapter rejecting a Windows database path in `DB_URI`. The sqlite adapter now expects everything after `sqlite:` to be a filesystem path and accepts both Windows and POSIX-style paths. This corrects an issue that prevented new projects from spinning up in the CLI when using `sqlite`.

## 1.0.0, 1.0.1

- Initial releases (no significant differences).


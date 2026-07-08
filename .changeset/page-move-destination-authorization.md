---
"apostrophe": patch
---

Security: restored destination-parent authorization in the page `move()` operation (GHSA-wr5r-wqp2-x4fh). A regression had gated the destination "create" permission check on the source page being restored out of the archive, which silently disabled that check for every ordinary move. As a result a low-privileged but content-editing user (for example an editor) who could edit at least one page could relocate that page under a parent of a restricted page type they have no create/edit rights over (such as one declaring a higher `editRole`/`publishRole`), and in doing so trigger an unchecked re-ranking of the restricted parent's existing children. A cross-parent move into a non-archive destination now again requires "create" permission on the destination, with the archive-restore path handled as an explicit exception. Thanks to 5ud0 / Tarmo Technologies for reporting the issue.

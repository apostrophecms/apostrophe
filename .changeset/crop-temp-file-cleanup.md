---
"apostrophe": patch
---

Security: the attachment crop route accepted crops with a zero width or height, which always failed during image processing, and a failed crop left behind a full-size temporary copy of the original image. Repeating the request could fill the server's disk. Zero-area crops are now rejected as invalid, and the temporary copy is always removed, whether or not cropping succeeds. Exploitation required a logged-in user with permission to upload attachments (contributor or above) (CWE-400, CWE-459, GHSA-cqpf-ff9v-mx8x).

Thanks to [Jace](https://github.com/manus-use) for reporting the vulnerability.

---
"@apostrophecms/form": patch
"@apostrophecms/login-recaptcha": patch
"@apostrophecms/login-hcaptcha": patch
---

Security: the CAPTCHA token submitted by the browser was inserted without encoding into the server-side verification request sent to reCAPTCHA (forms and login) or hCaptcha (login), so a crafted token could add or override parameters of that request. The verification parameters are now encoded with `URLSearchParams` and sent as a form-encoded POST body, and tokens that are not strings are rejected without being verified (CWE-88, GHSA-44qr-rrjg-2cqq).

Thanks to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for responsibly reporting the vulnerability.

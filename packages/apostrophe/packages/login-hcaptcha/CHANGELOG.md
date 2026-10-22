# Changelog

## 1.3.0 (2026-09-30)

### Adds

- The hCaptcha widget is displayed in the language of the admin UI (`defaultAdminLocale`, otherwise the locale of the login page), and the new `hcaptcha.hl` option of `@apostrophecms/login` forces a specific language.

### Security

- The CAPTCHA token submitted by the browser was inserted without encoding into the server-side verification request sent to reCAPTCHA (forms and login) or hCaptcha (login), so a crafted token could add or override parameters of that request. The verification parameters are now encoded with `URLSearchParams` and sent as a form-encoded POST body, and tokens that are not strings are rejected without being verified (CWE-88, GHSA-44qr-rrjg-2cqq).

  Thanks to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for reporting the vulnerability.

## 1.2.1 (2024-10-03)

- Adds translation strings

## 1.2.0 - 2023-08-16

### Adds

- Add `hcaptcha-complete` and `hcaptcha-invalid-token` structured logging events.

## 1.1.1 - 2023-02-17

- Remove `apostrophe` as a peer dependency.

## 1.1.0 - 2023-01-18

### Fixes

- Remove auto trigger hCaptcha workflow. The user now needs to manually check the box to start the hCaptcha workflow.

## 1.0.0 2022-09-15

### Adds

- Initial release

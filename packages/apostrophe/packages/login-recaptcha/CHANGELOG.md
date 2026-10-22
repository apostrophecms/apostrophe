# Changelog

## 1.2.1 (2026-09-30)

### Security

- The CAPTCHA token submitted by the browser was inserted without encoding into the server-side verification request sent to reCAPTCHA (forms and login) or hCaptcha (login), so a crafted token could add or override parameters of that request. The verification parameters are now encoded with `URLSearchParams` and sent as a form-encoded POST body, and tokens that are not strings are rejected without being verified (CWE-88, GHSA-44qr-rrjg-2cqq).

  Thanks to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for reporting the vulnerability.

## 1.2.0 (2024-02-21)

### Changes

- Switch from `beforeSubmit` phase to the new `uponSubmit` phase.

## 1.1.0 - 2023-08-16

### Adds

- Add `recaptcha-complete` and `recaptcha-invalid-token` structured logging events.

## 1.0.1 - 2023-02-17

Remove `apostrophe` as a peer dependency.

## 1.0.0 - 2023-01-16

Declared stable. No code changes.

## 1.0.0-beta - 2022-02-04

Beta release of a reCAPTCHA login requirement module.

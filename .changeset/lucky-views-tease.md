---
"apostrophe": patch
---

This previously undisclosed security vulnerability allowed users who had compromised a password to perform actions in the CMS without 2FA. For sites not using 2FA (e.g. our @apostrophecms/login-totp module), this changes nothing. But for those using our TOTP module or similar, upgrading to this release is urgent. Thanks to 0xkakashi for reporting the issue and recommending a fix.

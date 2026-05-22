---
"apostrophe": patch
---

Security fix: the password reset request feature will refuse to operate unless the baseUrl option or the APOS_BASE_URL environment variable has been set (note that this is automatic in multisite projects). This fix is necessary to prevent a vulnerability that can be used to convince ApostropheCMS to send emails containing links to other sites. It is only a vulnerability if you have enabled the passwordReset: true option for the login module. Thanks to [SPIDY](https://github.com/Mujahidkhan525) for reporting the issue.

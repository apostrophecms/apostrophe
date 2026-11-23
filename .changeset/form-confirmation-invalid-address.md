---
"@apostrophecms/form": patch
---

Fixed an error response for visitors who are not logged in when a form sends confirmation emails and the address they entered is not a valid email address. Their submission was saved, but the request failed while trying to show a notification meant for editors. The problem is now logged as a warning instead, and the submission completes normally. Logged-in users still see the notification.

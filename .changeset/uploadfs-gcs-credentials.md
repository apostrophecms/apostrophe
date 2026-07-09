---
"@apostrophecms/uploadfs": minor
---

uploadfs GCS credentials now relies directly on the Google Storage client rather than enforcing its own rules; this natively allows for application default credentials from `gcloud` credential files and the Google metadata servers (e.g. Cloud Run, Compute Engine) instead of only service accounts.

For more information, see https://docs.cloud.google.com/docs/authentication/application-default-credentials and https://docs.cloud.google.com/docs/authentication#auth-decision-tree

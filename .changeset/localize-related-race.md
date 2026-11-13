---
"apostrophe": patch
---

Fixed the Localize dialog briefly showing the question about related documents and then taking it away for a document with no related documents, which was noticeable on a slower connection. Changing a setting right after opening the dialog could also make the option to localize related documents, such as images, disappear when there were some. The dialog now shows its questions once it knows whether there are related documents.

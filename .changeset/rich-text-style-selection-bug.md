---
"apostrophe": patch
---

Fixed the rich text style picker marking the wrong style as active when multiple styles share the same tag. Styles are now matched in descending order of specificity (number of classes), so a `<p class="small">` correctly shows "Small" as the active style instead of the plain "Paragraph".

---
"@apostrophecms/event": minor
---

Adds the `maxRepeatCount` option, the largest number of repetitions a recurring event may have. It defaults to `366`. The "How many times does it repeat?" field now has this as its maximum, and a larger number is reduced to it when the event is saved. Previously there was no limit.

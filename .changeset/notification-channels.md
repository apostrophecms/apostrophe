---
"apostrophe": minor
---

Notifications: channels. A bus notification sent with `channel: 'type:id'` goes to every browser tab subscribed to that channel, rather than to one tab of one user. Channel messages are numbered in order, are never dismissed and expire after `channelExpireAfter` seconds (default 120). A channel type is registered with `apos.notification.addChannelType(name, { canSubscribe })`, which decides who may subscribe. In the browser, the notification store's `subscribeChannel` and `unsubscribeChannel` manage subscriptions, and messages ride the existing notification long poll, so no new connection is needed.

The database is the only source of truth for channel messages, whichever process triggered them, so delivery works the same with any number of processes. A poll subscribed to channels queries every `channelQueryInterval` milliseconds (default 150), rather than every `queryInterval`.

`apos.http` accepts a `signal` option (an `AbortSignal`) to abort a request.

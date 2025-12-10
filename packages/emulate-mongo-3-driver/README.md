# @apostrophecms/emulate-mongo-3-driver

## Purpose

You have legacy code that depends on the 3.x version of the MongoDB Node.js driver.
You don't want to upgrade to the 6.x driver because of backwards compability problems in
[v4](https://github.com/mongodb/node-mongodb-native/blob/v6.0.0/etc/notes/CHANGES_4.0.0.md),
[v5](https://github.com/mongodb/node-mongodb-native/blob/v6.0.0/etc/notes/CHANGES_5.0.0.md),
[v6](https://github.com/mongodb/node-mongodb-native/blob/v6.0.0/etc/notes/CHANGES_6.0.0.md)
but you don't have a choice because of reported vulnerabilities
such as those detected by `npm audit`.

`@apostrophecms/emulate-mongo-3-driver` aims to be a compatible emulation
of the 3.x version of the MongoDB Node.js driver,
implemented as a wrapper for the 6.x driver.

It was created for long term support of [ApostropheCMS](https://apostrophecms.com).
Of course, ApostropheCMS 3.x and 4.x will use the MongoDB 6.x driver directly.

## Usage

If you are using ApostropheCMS, this is **standard** beginning
with versions 3.64.0+ and 4.2.0+. You don't have to do anything.

The example below is for those who wish to use this driver in non-ApostropheCMS projects.

```sh
npm install @apostrophecms/emulate-mongo-3-driver
```

```javascript
const mongo = require('@apostrophecms/emulate-mongo-3-driver');

// Use it here as if it were the 3.x driver
```

## Goals

This module aims for partial compatibility with the features mentioned
as obsolete or changed in
[v4](https://github.com/mongodb/node-mongodb-native/blob/v6.0.0/etc/notes/CHANGES_4.0.0.md),
[v5](https://github.com/mongodb/node-mongodb-native/blob/v6.0.0/etc/notes/CHANGES_5.0.0.md),
[v6](https://github.com/mongodb/node-mongodb-native/blob/v6.0.0/etc/notes/CHANGES_6.0.0.md)
but there are omissions.

An emphasis has been placed on features used by ApostropheCMS
but PRs for further compatibility are welcome.

## What about those warnings?

"What about the warnings re: insert, update and ensureIndex operations being obsolete?"

Although deprecated, some of these operations are still supported by the 6.x driver
and work just fine.

However, since the preferred newer operations were also supported by the 3.x driver,
the path forward is clear.

We will migrate away from using them gradually, and you should do the same.

It doesn't make sense to provide "deprecation-free" wrappers
when doing the right thing is in easy reach.

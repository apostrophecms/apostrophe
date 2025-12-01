<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Apostrophe TOTP Login Verification</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Test status" href="https://github.com/apostrophecms/login-totp/actions">
      <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/apostrophecms/login-totp/Tests/main?label=Tests&labelColor=000000&style=for-the-badge">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/login-totp/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

This login verification module adds a [TOTP (Time-based One-Time Password)](https://en.wikipedia.org/wiki/Time-based_one-time_password) check when any user logs into the site, compatible with Google Authenticator or any TOTP app.
When activated, it will ask unregistered users to add a token to their app through a QR code. Once done, it will ask users to enter the code provided by their app after the initial login step.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/login-totp
```

## Usage

Instantiate the TOTP login module in the `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/login-totp': {}
  }
});
```

You must configure the `@apostrophecms/login` module with a TOTP secret, as shown. The secret must be **exactly 10 characters long.**

```javascript
// modules/@apostrophecms/login/index.js
module.exports = {
  options: {
    totp: {
      // Should be a random string, exactly 10 characters long
      secret: 'totpsecret'
    }
  }
};
```

> ⚠️ All configuration of TOTP related options is done on the `@apostrophecms/login` module. The `@apostrophecms/login-totp` module is just an "improvement" to that module, so it has no configuration options of its own.

### Resetting TOTP when a user loses their device

If a user loses their device, an admin can edit the appropriate user via the admin bar. Select "Yes" for the "Reset TOTP" field and save the user.

If an admin user loses their own device, they can reset TOTP via a command line task. Pass the username as the sole argument:

```
node app @apostrophecms/user:reset-totp username-goes-here
```

Once TOTP is reset, the user is able to set it up again on their next login.

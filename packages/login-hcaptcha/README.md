<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Apostrophe hCaptcha Login Verification</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Test status" href="https://github.com/apostrophecms/login-hcaptcha/actions">
      <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/apostrophecms/login-hcaptcha/Tests/main?label=Tests&labelColor=000000&style=for-the-badge">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/login-hcaptcha/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

This login verification module adds a [hCaptcha](https://hcaptcha.com) check when any user logs into the site.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/login-hcaptcha
```

## Usage

Instantiate the hCaptcha login module in the `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/login-hcaptcha': {}
  }
});
```

The other requirement is to add your [hCaptcha public API site key](https://docs.hcaptcha.com/configuration#hcaptcha-container-configuration) to the `@apostrophecms/login` module (*not* this module). This module adds functionality to that module (it "improves" it, in Apostrophe speak), so most configuration should be directly on the core login module.


```javascript
// modules/@apostrophecms/login/index.js
module.exports = {
  options: {
    hcaptcha: {
      site: 'ADD YOUR SITE KEY',
      secret: 'ADD YOUR SECRET KEY'
    }
  }
};
```

Once configured, hCaptcha verification should work on all login attempts.

### Content security headers

If your site has a content security policy, including if you use the [Apostrophe Security Headers](https://www.npmjs.com/package/@apostrophecms/security-headers) module, you will need to add additional configuration to use this module. This module adds a script tag to the site's `head` tag fetching hCaptcha code, so we need to allow resources from that domain.

**If you are using the Apostrophe Security Headers module**, add the following policy configuration for that module:

```javascript
module.exports = {
  options: {
    policies: {
      'login-hcaptcha': {
        'script-src': 'hcaptcha.com *.hcaptcha.com',
        'frame-src': 'hcaptcha.com *.hcaptcha.com',
        'style-src': 'hcaptcha.com *.hcaptcha.com',
        'connect-src': 'hcaptcha.com *.hcaptcha.com'
      },
      // Any other policies...
    }
  }
};
```

**If your content security policy is configured some other way**, add `hcaptcha.com  *.hcaptcha.com` to the `script-src`, `frame-src`, `style-src` and `connect-src` directives.

Please refer to the list at https://docs.hcaptcha.com/#content-security-policy-settings for any additional settings.

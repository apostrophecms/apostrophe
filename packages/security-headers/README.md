<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Security Headers</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Test status" href="https://github.com/apostrophecms/security-headers/actions">
      <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/apostrophecms/security-headers/tests/main?label=Tests&logo=github&labelColor=000&style=for-the-badge">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/security-headers/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

This module sends the modern HTTP security headers that are expected by various security scanners. The default settings are strict in most regards, so see below for adjustments you may wish to make.

## Warning

Some third-party services, including Google Analytics, Google Fonts, YouTube and Vimeo, are included as allowed sources for HTML, CSS and scripts in the standard configuration. However even with these permissive settings not all third-party services compatible with Apostrophe will be permitted out of the box. For instance, because they are used relatively rarely, no special testing has been done for Wufoo or Infogram. You should test your site and configure custom policies accordingly.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/security-headers
```

## Usage

Activate the `@apostrophecms/security-headers` module in the project's `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/security-headers': {}
  }
});
```

The headers to be sent can be overriden by setting them as options to the module in the project-level `modules/@apostrophecms/security-headers/index.js` file:

```javascript
// in modules/@apostrophecms/security-headers/index.js
module.exports = {
  options: {
    'X-Frame-Options': 'DENY'
  }
};
```

You can also disable a header entirely by setting the option for it to `false`.

### Guide to configuring headers

Here are the headers that are sent by default, with their default values:

```javascript
module.exports = {
  // in modules/@apostrophecms/security-headers/index.js
  options: {
    // 1 year. Do not include subdomains as they could be unrelated sites
    'Strict-Transport-Security': 'max-age=31536000',
    // You may also set to DENY, however future Apostrophe modules may use
    // iframes to present previews etc.
    'X-Frame-Options': 'SAMEORIGIN',
    // If you have issues with broken images etc., make sure content type
    // configuration is correct for your production server
    'X-Content-Type-Options': 'nosniff',
    // Very new. Used to entirely disable browser features like geolocation per host.
    // Since we don't know what your site may need, we don't try to set this
    // header by default (false means "don't send the header")
    'Permissions-Policy': false,
    // Don't send a "Referer" (sp) header unless the new URL shares the same
    // origin. You can set this to `false` if you prefer cross-origin "Referer"
    // headers be sent. Apostrophe does not rely on them
    'Referrer-Policy': 'same-origin',
    // `true` means it should be computed according to the rules below.
    // You may also pass your own string, or `false` to not send this header.
    // The `policies` option and all of its sub-options are ignored unless
    // `Content-Security-Policy` is `true`.
    'Content-Security-Policy': true
  }
};
```

For more information about these security headers see the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security).

### Configuring the `Content-Security-Policy` header

The `Content-Security-Policy` header is more complex than the others. As described [in MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy), this header is used to determine which hosts are permitted as a source for stylesheets, scripts, images and more. While you can certainly set a fixed value for it, the default response for it is the result of merging together options for individual use cases ("policies") as shown below. This makes it easier to think about what you need to allow for a particular purpose. The actual header sent contains all of the permissions required to satisfy all of the policies.

The default configuration is shown below. You do **not** have to copy and paste the entire default configuration, only the policies you wish to change. Any policy you specify explicitly at project level overrides all of the default settings shown below for that
policy. You may set one to `false` to completely disable it. You may also introduce entirely new policies.

Policies of the same type from different sub-options are merged, with the largest set of keywords and hosts enabled. This is done because browsers do not support more than one style-src policy, for example, but do support specifying several hosts.

Note the `HOSTS` wildcard which matches all expected hosts that Apostrophe is aware of, including `baseUrl` settings, CDN hosts and locale-specific hostnames.

```javascript
module.exports = {
  // in modules/@apostrophecms/security-headers/index.js
  options: {
    policies: {
      general: {
        'default-src': 'HOSTS',
        // Because it is necessary for some of the output of our rich text editor
        'style-src': "HOSTS 'unsafe-inline'",
        'script-src': 'HOSTS',
        'font-src': 'HOSTS',
        'img-src': 'HOSTS blob:',
        'frame-src': "'self'"
      },

      // Set this sub-option to false if you wish to forbid google fonts
      googleFonts: {
        'style-src': 'fonts.googleapis.com',
        'font-src': 'fonts.gstatic.com'
      },

      // Set this sub-option to false if you do not use the video widget
      oembed: {
        'frame-src': '*.youtube.com *.vimeo.com',
        'img-src': '*.ytimg.com'
      },

      // Set this sub-option to false if you do not wish to permit Google Analytics and
      // Google Adsense
      analytics: {
        'default-src': '*.google-analytics.com *.doubleclick.net',
        // Note that use of google tag manager by definition brings in scripts from
        // more third party sites and you will need to add policies for them
        'script-src': '*.google-analytics.com *.doubleclick.net *.googletagmanager.com',
      }
    }
  }
};
```

#### Inline style attributes are still allowed

Note that `style-src` is set by default to permit inline style attributes. This is currently necessary because the output of the tiptap rich text editor used in Apostrophe involves inline
styles in some cases.

#### Inline script tags are **not** allowed

Inline script tags (those without a `src`) are **not** allowed by the default policies shown above, as this is one of the primary benefits of using the `Content-Security-Policy` header. If you do choose to output an inline script tag, you may do so if you use the "nonce" template argument provided by this module, like this:

```
<script nonce="{{ nonce }}">
  // inline script code here
</script>
```

The `nonce` template variable is always available in Nunjucks templates when using this module. It is generated uniquely for each new page request.

The nonce mechanism ensures that the script tag was the intention of the developer and is not an XSS attack. However please note that you will lose the security benefits of this if you output other user-entered data inside the script tag without properly escaping it, for instance using the `| json` nunjucks filter.

Setting the nonce attribute on a DOM element has no ill effects when this module is not in use, so it is OK to set it in inline script tags output by npm modules intended for use with or without this module.

### Custom policies

You may add any number of custom policies. Any sub-option nested in your
`policies` option is treated just like the standard cases above and merged into
the final `Content-Security-Policy` header.

### Disabling standard policies

You may set any of the standard policy sub-options above to `false` to disable them.

### Hosts wildcard

Note that the `HOSTS` wildcard is automatically replaced with a list of hosts including any `baseUrl` host, localized hostnames for specific locales, CDN hosts from your uploadfs configuration, and `self`. Use of this wildcard is recommended as Apostrophe pushes assets to Amazon S3, CDNs, etc. when configured to do so, including scripts and stylesheets.

You may override the normal list of hosts for `HOSTS` by setting the `legitimateHosts` option to an array of strings. You can also extend or override the `legitimateHosts` method of this module at project level.

For example:

```javascript
module.exports = {
  // in modules/@apostrophecms/security-headers/index.js
  options: {
    legitimateHosts: [ 'mysite.com', 'www.mysite.com', 'surprise.mysite.com' ]
  }
};
```

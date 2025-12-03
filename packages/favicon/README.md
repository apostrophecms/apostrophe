<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Favicons for ApostropheCMS</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
  </p>
</div>

This module allows users to edit the "favicon" (browser tab icon) of the site via the global settings of the site.
As such, it pairs well with the Apostrophe palette and multisite modules.

## Compatibility
This version requires the latest ApostropheCMS. When adding this module to an existing project, run `npm update` to ensure all ApostropheCMS modules are up-to-date.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/favicon
```

## Usage

Configure the `@apostrophecms/favicon` module in the `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/favicon': {}
  }
});
```

You do not have to do anything else. You can access the global settings of the site
via the "Gear" button in the upper right. Once there, select the "Favicon" tab and
choose your preferred image. Note that a square portion of the image is automatically
cropped if you do not use the cropping interface manually.

There are no special requirements for images uploaded for this purpose, however you may
wish to use a PNG file in order to achieve transparency effects.

> Browsers vary in terms of how quickly you will see the new favicon image, but a
> page refresh usually suffices.

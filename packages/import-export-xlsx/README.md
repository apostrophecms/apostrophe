<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>XLSX format for Import Export Module</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/import-export/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

This module improves [@apostrophecms/import-export](https://github.com/apostrophecms/import-export) by adding the `xlsx` format.

> Why does this specific format lies in another module?

Because it relies on a [dependency that is not hosted on NPM](https://github.com/SheetJS/sheetjs/issues/2667), which could lead to installation issues on networks that limit connections to NPM repository only.

## Requirement

[@apostrophecms/import-export](https://github.com/apostrophecms/import-export) should be installed and instantiated.

Please refer to the module's [README](https://github.com/apostrophecms/import-export#readme) before continuing.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/import-export-xlsx
```

## Usage

Configure the module in the `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/import-export': {},
    '@apostrophecms/import-export-xlsx': {}
  }
});
```

> Please note that `apos` is not passed to the `input` and `output` functions of the format, as they should remain agnostic of apostrophe and only deal with retrieving and writing the documents from/to the `.xlsx` file.


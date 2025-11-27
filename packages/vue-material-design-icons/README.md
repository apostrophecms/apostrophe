<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Vue Material Design Icons</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
  </p>
</div>

A fork of [`vue-material-design-icons`](https://github.com/robcresswell/vue-material-design-icons) to maintain consistent icons naming for ApostropheCMS users.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```sh
npm install @apostrophecms/vue-material-design-icons
```

See how to register and use icons from this library in your [Apostrophe project here](https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#icons).

 They also can be used in you vue components directly:

   ```javascript
   import CheckIcon from '@apostrophecms/vue-material-design-icons/Check.vue';

   components: {
     CheckIcon;
   }
   ```

Then use it in your template code!

   ```html
   <CheckIcon />
   ```

**Optional** Add the included stylesheet. This few lines of CSS will cause
the icons to scale with any surrounding text, which can be helpful when you
primarily style with CSS. Note that if you intend to handle sizing with the
`size` prop, you probably don't want to use this as it may conflict.

```javascript
import '@apostrophecms/vue-material-design-icons/styles.css';
```

## Props

- `title` - This changes the hover tooltip as well as the title shown to screen
  readers. For accessibility purposes, if a `title` is not provided, then the
  icon is hidden from screen readers. This is to force developers to use
  meaningful titles for their icon usage.

  Example:

  ```html
  <CheckIcon title="this is an icon!" />
  ```

- `fillColor` - This property allows you to set the fill colour of an icon via
  JS instead of requiring CSS changes. Note that any CSS values, such as
  `fill: currentColor;` provided by the optional CSS file, may override colours
  set with this prop.

  Example:

  ```html
  <CheckIcon fillColor="#FF0000" />
  ```

- `size` - This property overrides the `width` and `height` attributes on the
  SVG. The default is `24`.

  Example:

  ```html
  <CheckIcon :size="48" />
  ```

## Credits

[Rob Cresswell  / robcresswell](https://github.com/robcresswell "robcresswell GitHub profile") for
the [Vue Material Design Icons](https://github.com/robcresswell/vue-material-design-icons 'Vue Material Design Icons Github page')
project. This library has been forked on. 


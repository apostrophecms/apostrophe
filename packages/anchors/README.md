<div align="center"> 
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80" />

  <h1>Apostrophe Anchors</h1>

  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20" />
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/anchors/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639" />
    </a>
  </p>
</div>

**Enable deep linking and smooth navigation** with automatic anchor generation for all ApostropheCMS widgets. Perfect for landing pages, documentation sites, and content-heavy applications where users need to link directly to specific sections.

## Why Apostrophe Anchors?

- **🎯 Improve User Experience**: Let visitors bookmark and share links to specific content sections
- **📈 Boost SEO**: Search engines can index and link directly to your content sections
- **⚡ Zero Configuration**: Works automatically with all widget types out of the box
- **🛠️ Developer Friendly**: Customize anchor attributes and disable for specific widgets as needed
- **🔗 Marketing Ready**: Perfect for campaign landing pages where you need to link to specific sections

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```bash
npm install @apostrophecms/anchors
```

## Usage

Configure the anchor modules in the `app.js` file:

```javascript
import apostrophe from 'apostrophe';

apostrophe ({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/anchors': {},
  }
});
```

When the modules are active, all widget types will have a new "HTML Anchor Value" field. When an editor populates that field with a slug-style string, the widget HTML markup will be wrapped with a new `div` with an attribute (an `id` by default) set to the anchor value. This attribute can be targeted by anchor links, e.g., `href="#anchor-id-value"`.

The only Apostrophe core widget type with this feature disabled is the rich text widget, `@apostrophecms/rich-text-widget`.

The "HTML Anchor Value" field is a "slug" type field, which means it is limited to lowercase characters and dashes for consistent usage.

## Configuration Options

### `anchorAttribute`

By default, the anchor attribute is an `id`. This makes it easy to link to the widget with a hash `href` matching the anchor value as described above. **Developers have the option to use another anchor attribute** if they prefer to target the HTML element with custom JavaScript instead.

To do this, include an `anchorAttribute` option on the individual widget type. You can also add this option on the root `@apostrophecms/widget-type` module or the `@apostrophecms/anchors-widget-type` module to set this for all widget types.

```javascript
// modules/my-banner-widget/index.js
export default {
  options: {
    anchorAttribute: 'data-anchor'
  }
};
```

In this example the wrapping `div` element would look like this:

```html
<div data-anchor="anchor-id-value">
  <!-- Normal widget markup here -->
</div>
```

### `anchors: false`

Developers can choose to disable this module's features for any widget type by setting an `anchors: false` option on the widget type.

```javascript
// modules/my-banner-widget/index.js
export default {
  options: {
    anchors: false
  }
};
```

This is automatically set for the rich text widget. That can be reversed by setting `anchors: true` on `@apostrophecms/rich-text-widget`.

### `anchorDefault`

To help content editors populate anchor values automatically, set the `anchorDefault` option to the name of an existing field on a widget type. The "HTML Anchor Value" field will populate automatically based on the value of the named field [using the `following` field option mechanism](https://docs.apostrophecms.org/reference/field-types/slug.html#optional).

```javascript
// modules/my-banner-widget/index.js
export default {
  options: {
    anchorDefault: 'heading'
  },
  fields: {
    add: {
      heading: {
        type: 'string',
        label: 'Heading'
      }
    }
  }
};
```

## Use Cases

**Landing Pages**: Create marketing pages where different sections can be linked to directly from emails, ads, or social media.

**Documentation**: Allow readers to bookmark and share links to specific sections of your documentation.

**Long-form Content**: Help readers navigate lengthy articles or reports by providing direct links to sections.

**Campaign Pages**: Enable marketing campaigns to link directly to specific product features or testimonials.

### Getting Started with Astro + ApostropheCMS

New to using ApostropheCMS with Astro? Check out our starter kits:
- **[starter-kit-astro-essentials](https://github.com/apostrophecms/starter-kit-astro-essentials)** - Essential features for most projects
- **[starter-kit-astro-apollo](https://github.com/apostrophecms/starter-kit-astro-apollo)** - Advanced features with Apollo integration

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/anchors">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>

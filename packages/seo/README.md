<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>SEO Tools for ApostropheCMS</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/seo/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

**Ensure your content gets found by search engines and AI systems** with comprehensive SEO management for ApostropheCMS. Essential meta fields, Google Analytics integration, and automated `robots.txt` generation—everything you need to boost your search rankings and drive organic traffic.

## Why ApostropheCMS SEO Tools?

- **🎯 Complete SEO Control**: Essential meta fields for titles, descriptions, and canonical URLs
- **📊 Analytics Ready**: Built-in Google Analytics, Tag Manager, and Site Verification integration  
- **🤖 Smart Automation**: Automatic robots.txt generation with granular control
- **⚡ Zero Configuration**: Works out of the box with all page and piece types
- **🔍 Search Engine Friendly**: Proper canonical linking prevents duplicate content issues
- **📈 Marketing Team Ready**: Easy-to-use interface for non-technical content creators

## Compatibility

This version requires the latest ApostropheCMS. When adding this module to an existing project, run `npm update` to ensure all ApostropheCMS modules are up-to-date.

## Installation

```bash
npm install @apostrophecms/seo
```

## Quick Start

Configure the module in your `app.js` file:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/seo': {}
  }
});
```

**Important:** For proper SEO functionality, you must also configure your site's base URL. See the [Setting the Base URL](#setting-the-base-url) section below.

## Core Features

### Automatic SEO Fields

![The module adds an SEO tab to your editing modals](https://static.apostrophecms.com/apostrophecms/seo/images/seo-modal.png)

The module automatically adds an "SEO" tab to all page and piece editors containing:

- **Title Tag**: Custom titles for search results (falls back to page title)
- **Meta Description**: Compelling descriptions that appear in search results
- **Robots Meta Tag**: Control search engine indexing and following behavior
- **Canonical URLs**: Prevent duplicate content penalties

### Google Analytics Integration

Enable Google Analytics tracking by configuring your global module:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/seo': {},
    '@apostrophecms/global': {
      options: {
        seoGoogleAnalytics: true
      }
    }
  }
});
```
This adds a field in the global configuration for entering your Google Analytics Measurement ID (e.g., `G-XXXXXXXXXX`), which you can find in your Google Analytics account.

### Google Tag Manager Integration

For advanced tracking and marketing campaigns:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/seo': {},
    '@apostrophecms/global': {
      options: {
        seoGoogleTagManager: true
      }
    }
  }
});
```

This adds a Google Tag Manager container ID field to your global configuration. Enter your GTM container ID (e.g., `GTM-XXXXXXX`), which you can find in your Google Tag Manager account, to enable tracking.

### Google Site Verification

Verify your site ownership for Google Search Console:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/seo': {},
    '@apostrophecms/global': {
      options: {
        seoGoogleVerification: true
      }
    }
  }
});
```

This adds a Google Site Verification ID field to your global configuration. Enter your verification meta tag content (obtained from Google Search Console) in the global settings to verify site ownership.

## Configuration

### Setting the Base URL

**This step is required for proper canonical link generation and SEO performance.** If using [ApostropheCMS hosting](https://apostrophecms.com/hosting), this is set automatically. If you are self-hosted, configure your site's base URL as shown for accurate canonical links and proper search engine indexing.

**Via environment variable (recommended):**
```bash
export APOS_BASE_URL=https://yoursite.com
```

**Via configuration file:**
```javascript
// data/local.js
export default {
  baseUrl: 'https://yoursite.com',
  modules: {
    // other module configuration
  }
};
```

**For multisite projects using ApostropheCMS Assembly:**
If you're managing multiple sites with our Assembly platform, the base URL is automatically configured through the `baseUrlDomains` option. [Learn more about Assembly multisite hosting](https://apostrophecms.com/assembly).

### Disabling SEO Fields

To disable SEO fields for specific page or piece types:

```javascript
// modules/my-piece-type/index.js
export default {
  extend: '@apostrophecms/piece-type',
  options: {
    // Disables SEO tab
    seoFields: false
  }
};
```

The following modules disable SEO fields by default:
- `@apostrophecms/global`
- `@apostrophecms/user`
- `@apostrophecms/image`
- `@apostrophecms/image-tag`
- `@apostrophecms/file`
- `@apostrophecms/file-tag`

### Canonical Link Configuration

"Canonical links" are useful when a piece or page should **not** be considered the official version of a document, and you would prefer that search engines look elsewhere. This feature is always available for pages.

[As described on Moz.com](https://moz.com/learn/seo/canonicalization): “A canonical tag, also known as 'rel canonical', is a method for informing search engines that a certain URL, referred to as the canonical URL, is the master copy of a page.” Using the canonical tag prevents problems caused by identical or 'duplicate' content appearing on multiple URLs. Practically speaking, the canonical tag tells search engines which version of a URL you want to appear in search results.

If you wish to have this feature for a piece type, you will need to specify the `seoCanonicalTypes` option to that piece type module, as an array of types that the editor can choose from.

```javascript
// modules/article/index.js
export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    // Allow editors to select a published page or `topic` piece as canonical references
    seoCanonicalTypes: [ '@apostrophecms/page', 'topic' ]
  }
};
```

This adds additional fields in the SEO tab for choosing a canonical document for search engines to consider instead.

> Note that you cannot link to specific page-types, only all pages through `@apostrophecms/page`, but you can link to specific piece-types.

### Robots.txt Management

The module automatically provides a `/robots.txt` route. By default, it returns content that allows all search engines to index your site:

```
User-agent: *
Disallow:
```

By clicking on the global settings gear button in the UI you can choose to change this to disallow search engine indexing:
```
User-agent: *
Disallow: /
```

You can also select to add a custom string for your `robots.txt`. This allows you finer control over what sections of your site can be indexed and by which bots.

Note that if you allow search engines to index your site, you can still set `noindex` and/or `nofollow` on a per-page basis from the SEO tab of individual page editing modals. If you disallow indexing of your site, settings for individual pages will be ignored.

A physical `robots.txt` file in `public/robots.txt`, or `sites/public/robots.txt` in an Assembly project, will override any settings made in this module. If you don't want a one-size-fits-all policy for all sites, don't use a physical file.

## Advanced Features

### Custom 404 Tracking

Track 404 errors in Google Analytics by adding this to your `notFound.html` template:

```nunjucks
{% block extraBody %}
  {{ super() }}
  {% include "@apostrophecms/seo:404.html" %}
{% endblock %}
```

> **Note:** If you already have an `extraBody` block in your template, just add the `{% include "@apostrophecms/seo:404.html" %}` line inside it. The `{{ super() }}` call is optional if you're extending an existing block from another template.

This automatically sends 404 events to Google Analytics when a tracking ID is configured, helping you identify broken links and problematic URLs.

### Field Reference

|Name |Description  | Module Effected | Module Option |
--- | --- | --- | ---
|`seoTitle`|Title attribute, populates `<meta name="title" />` tag|`@apostrophecms/doc-type`|_Enabled by default_|
|`seoDescription`|Description attribute, populates `<meta name="description" />` tag|`@apostrophecms/doc-type`|_Enabled by default_|
|`seoRobots`|Robots attribute, populates `<meta name="robots" />` tag|`@apostrophecms/doc-type`|_Enabled by default_|
|`_seoCanonical`|[Canonical URL](https://moz.com/learn/seo/canonicalization), populates `<link rel="canonical" />` tag|`@apostrophecms/page-type`|_Enabled by default_|
|`seoGoogleTagManager`|Google Tag Manager Container ID|`@apostrophecms/global`|`seoGoogleTagManager: true`|
|`seoGoogleTrackingId`|Google Analytics ID|`@apostrophecms/global`|`seoGoogleAnalytics: true`|
|`seoGoogleVerificationId`|Google Verification ID, populates `<meta name="google-site-verification" />`|`@apostrophecms/global`|`seoGoogleVerification: true`|

## 🚀 Ready for AI-Powered SEO?

**Want to supercharge your SEO workflow?** Create an account on Apostrophe Workspaces and upgrade to [**ApostropheCMS Pro**](https://app.apostrophecms.com/login) now. Get access to the [**SEO Assistant**](https://apostrophecms.com/extensions/seo-assistant) with AI-powered content optimization and additional Pro modules:

### ✨ SEO Assistant Pro Features
- **🤖 AI-Generated Meta Titles**: Compelling, keyword-optimized titles generated automatically
- **📝 Smart Meta Descriptions**: AI-crafted descriptions that drive clicks
- **🎯 Content Analysis**: Get suggestions based on your actual page content
- **⚡ One-Click Optimization**: Generate, review, and apply SEO improvements instantly
- **🔄 Multiple Suggestions**: Try different approaches with regeneration options
- **✏️ Custom Prompts**: Fine-tune AI behavior for your brand voice

The SEO Assistant analyzes your page content and generates optimized meta titles and descriptions using advanced AI, making professional SEO accessible to content creators of all skill levels.

**[Contact us](https://apostrophecms.com/contact-us)** to learn more about ApostropheCMS Pro and unlock AI-powered SEO optimization.

## 🏢 Managing Multiple Sites?

**Running multiple websites with shared content and branding?** Consider [**ApostropheCMS Assembly**](https://apostrophecms.com/assembly) for enterprise multisite management:

### ✨ Assembly Multisite Features
- **🏗️ Centralized Management**: Control multiple sites from a single dashboard
- **🚀 Shared Codebase**: Deploy updates across all sites simultaneously  
- **🌍 Multi-Domain Support**: Each site gets its own domain with automatic SSL
- **⚙️ Automatic SEO Configuration**: Base URLs and canonical links configured automatically
- **🎨 Per-Site Customization**: Individual themes, content, and settings per site
- **📊 Unified Analytics**: Track performance across your entire site network

Perfect for agencies, franchises, or organizations managing multiple branded websites with consistent functionality but unique content and design.

**[Learn more about the multisite extension](https://apostrophecms.com/extensions/multisite-apostrophe-assembly)**, **[Assembly licensing](https://apostrophecms.com/assembly)** or **[contact our team](https://apostrophecms.com/contact-us)** to discuss your multisite needs.

## Roadmap

| Feature | Status |
|---------|--------|
| SEO Meta fields for pages and pieces | ✅ Implemented |
| Google Analytics & Tag Manager integration | ✅ Implemented |
| Automated robots.txt generation | ✅ Implemented |
| SEO Assistant (AI-powered) | 🚀 Available in Pro |
| SEO Page Scanner | 🚧 Under development |

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/seo">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>
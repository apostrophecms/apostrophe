<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Apostrophe Blog</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/blog/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

**Add blog functionality to ApostropheCMS sites** with article management, date-based filtering, and multiple blog support. Provides both the blog piece type and page templates to get started quickly.

## Features

- **📝 Blog Article Management** - Complete CRUD interface for blog posts with publication dates
- **🗓️ Date-based Filtering** - Built-in year/month/day query filters for archives and navigation
- **🎨 Fully Customizable** — Override templates, add fields, and style it to match your brand
- **🔗 Multiple Blog Types** - Extend to create different blog categories (news, updates, etc.)
- **⏰ Publication Control** - Articles only appear when published date is in the past

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```bash
npm install @apostrophecms/blog
```

## Usage

Configure the blog modules in your `app.js` file:

```javascript
import apostrophe from 'apostrophe';

export default apostrophe({
  root: import.meta,
  shortName: 'my-project',
  bundles: [ '@apostrophecms/blog' ],
  modules: {
    '@apostrophecms/blog': {},
    '@apostrophecms/blog-page': {}
  }
});
```

### Enable the page type

Add the blog page type to your page configuration:

```javascript
// modules/@apostrophecms/page/index.js
export default {
  options: {
    types: [
      {
        name: '@apostrophecms/home-page',
        label: 'Home'
      },
      {
        name: '@apostrophecms/blog-page',
        label: 'Blog'
      }
    ]
  }
};
```

## Customizing Templates

The included templates (`index.html`, `show.html`, `filters.html`) are starting points that demonstrate the available data. Override them in your project to implement your own styling and layout:

```
modules/
├── @apostrophecms/
│   └── blog-page/
│       └── views/
│           ├── index.html      # Blog listing page
│           ├── show.html       # Individual blog post
│           └── filters.html    # Date filtering controls
```

## Date-based Filtering

The blog includes built-in query filters for creating archive navigation and date-based URLs:

| Filter | Format | Example URL |
|--------|--------|-------------|
| `year` | `YYYY` | `/blog?year=2024` |
| `month` | `YYYY-MM` | `/blog?month=2024-03` |
| `day` | `YYYY-MM-DD` | `/blog?day=2024-03-15` |

### Publication Control

Blog posts use the `publishedAt` field to control visibility. Only articles with publication dates in the past appear on the public site. Editors see all articles in the admin interface.

> **Note:** This doesn't automatically publish draft changes on the publication date. For scheduled publishing of draft content, consider the [@apostrophecms/scheduled-publishing](https://apostrophecms.com/extensions/scheduled-publishing) module.

## Multiple Blog Types

Sometimes a website needs multiple, distinct types of blog posts. If the blog posts types can be managed together, it might be easiest to [add a new field](https://docs.apostrophecms.org/guide/content-schema.html#using-existing-field-groups) and [query builder](https://docs.apostrophecms.org/reference/module-api/module-overview.html#queries-self-query) to customize blog views. But if the blog posts types should be managed completely separately, it may be better to create separate piece types for each.

### Creating a Custom Blog Type

```javascript
// modules/news-blog/index.js - for news articles
export default {
  extend: '@apostrophecms/blog',
  options: {
    label: 'News Article',
    pluralLabel: 'News Articles'
  },
  fields: {
    add: {
      priority: {
        type: 'select',
        choices: [
          { label: 'Standard', value: 'standard' },
          { label: 'Breaking', value: 'breaking' },
          { label: 'Featured', value: 'featured' }
        ]
      },
      source: {
        type: 'string',
        label: 'News Source',
        help: 'Original source of this news item'
      }
    },
    group: {
      basics: { fields: ['priority', 'source'] }
    }
  }
};
```

Every blog piece type needs a corresponding page type that extends `@apostrophecms/blog-page`:

```javascript
// modules/news-blog-page/index.js - page type for news articles
export default {
  extend: '@apostrophecms/blog-page'
};
```

### Custom Templates for Blog Types

Each blog type can have its own templates. Create them in the corresponding page module:

```
modules/
├── news-blog-page/
│   └── views/
│       ├── index.html      # News listing page
│       ├── show.html       # Individual news article
│       └── filters.html    # Custom filters for news
└── @apostrophecms/
    └── blog-page/
        └── views/
            ├── index.html  # Default blog listing
            └── show.html   # Default blog post
```

This allows you to:
- Style news articles differently from regular blog posts
- Add custom filtering options specific to news content
- Display different fields or layouts for each blog type
- Create distinct navigation and user experiences

This approach works well when blog types have different:
- **Content structures** - News articles vs. technical tutorials vs. company announcements
- **Editorial workflows** - Different teams managing different content types
- **Display requirements** - Unique styling, filtering, or organization needs
- **URL patterns** - `/blog/`, `/news/`, `/updates/` with distinct navigation

## Field Reference

The blog piece type includes these fields by default:

- **Title** (`title`) - Article headline
- **Slug** (`slug`) - URL-friendly identifier  
- **Publication Date** (`publishedAt`) - Controls public visibility
- **Content** (`body`) - Rich text content area
- **Meta Description** (`metaDescription`) - SEO description
- **Tags** (`tags`) - Taxonomy for categorization

---
*Built with ❤️ by the ApostropheCMS team.*
---
**Found this useful?** [Give us a star on GitHub](https://github.com/apostrophecms/blog) ⭐
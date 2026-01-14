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

**Ensure your content gets found by search engines and AI systems** with comprehensive SEO management for ApostropheCMS. Essential meta fields, Google Analytics integration, automated `robots.txt` and `llms.txt` generation — everything you need to boost your search rankings, control AI training usage, and drive organic traffic.
<!-- omit in toc-->
## Why ApostropheCMS SEO Tools?

- **🎯 Complete SEO Control**: Essential meta fields for titles, descriptions, and canonical URLs
- **📊 Analytics Ready**: Built-in Google Analytics, Tag Manager, and Site Verification integration
- **🤖 Smart Automation**: Automatic robots.txt generation with granular control
- **⚡ Performance Optimization**: Critical font preloading improves Core Web Vitals scores
- **🔍 Search Engine Friendly**: Proper canonical linking prevents duplicate content issues
- **📈 Marketing Team Ready**: Easy-to-use interface for non-technical content creators
- **💰 E-commerce Ready**: Rich structured data for products, offers, and pricing
- **🤖 AI-Ready**: Automatic llms.txt generation for AI policy transparency (proposed standard for forward-thinking SEO)

<!-- omit in toc -->
## Compatibility

This version requires the latest ApostropheCMS. When adding this module to an existing project, run `npm update` to ensure all ApostropheCMS modules are up-to-date.

---

## TL;DR: Quick Setup

1. Install the module:

   ```bash
   npm install @apostrophecms/seo
   ```
2. Set your base URL (`APOS_BASE_URL`).
3. Enable Google Analytics or Tag Manager in `@apostrophecms/global`.
4. Optionally install `@apostrophecms/sitemap` for XML sitemap generation.
5. Configure `robots.txt` and `llms.txt` via global settings.
6. Choose schema types per page in the SEO tab.
7. Validate your structured data using [Google’s Rich Results Test](https://search.google.com/test/rich-results).

---

## Table of Contents

- [Why ApostropheCMS SEO Tools?](#why-apostrophecms-seo-tools)
- [TL;DR: Quick Setup](#tldr-quick-setup)
- [Table of Contents](#table-of-contents)
- [Installation](#installation)
- [Before You Start](#before-you-start)
  - [✅ Works Immediately (No Setup Required)](#-works-immediately-no-setup-required)
  - [⚙️ Requires Content Structure Setup](#️-requires-content-structure-setup)
- [Core Features](#core-features)
  - [Automatic SEO Fields](#automatic-seo-fields)
  - [Google Analytics \& Tag Manager](#google-analytics--tag-manager)
  - [Automated Robots.txt](#automated-robotstxt)
  - [AI Crawler Control (llms.txt)](#ai-crawler-control-llmstxt)
  - [Sitemap Integration](#sitemap-integration)
  - [Performance Optimization](#performance-optimization)
- [Essential Configuration](#essential-configuration)
  - [Setting the Base URL](#setting-the-base-url)
  - [Google Analytics Integration](#google-analytics-integration)
  - [Google Tag Manager Integration](#google-tag-manager-integration)
  - [Google Site Verification](#google-site-verification)
  - [Sitemap Installation](#sitemap-installation)
- [Structured Data \& Schema Types](#structured-data--schema-types)
  - [How It Works](#how-it-works)
  - [Choosing the Right Schema](#choosing-the-right-schema)
  - [Quick Schema Selection Guide](#quick-schema-selection-guide)
  - [Best Practices](#best-practices)
- [AI \& Search Strategy](#ai--search-strategy)
  - [Understanding Crawler Types](#understanding-crawler-types)
  - [Recommended Configuration for Most Sites](#recommended-configuration-for-most-sites)
  - [For Maximum AI Visibility](#for-maximum-ai-visibility)
  - [For Maximum Privacy/Protection](#for-maximum-privacyprotection)
  - [Understanding robots.txt vs llms.txt](#understanding-robotstxt-vs-llmstxt)
  - [Site Search Query Parameter](#site-search-query-parameter)
- [Advanced Configuration](#advanced-configuration)
  - [Disabling SEO Fields](#disabling-seo-fields)
  - [Setting Default Schema Types](#setting-default-schema-types)
  - [Canonical Link Configuration](#canonical-link-configuration)
  - [Pagination Support](#pagination-support)
  - [Custom 404 Tracking](#custom-404-tracking)
  - [Paywalled Content](#paywalled-content)
  - [Custom Field Mappings](#custom-field-mappings)
- [Implementation Guidelines for Developers](#implementation-guidelines-for-developers)
  - [Field Flexibility](#field-flexibility)
  - [Flexible Field Formats](#flexible-field-formats)
  - [Debug Mode](#debug-mode)
  - [Featured Images](#featured-images)
  - [Author Information](#author-information-1)
  - [URL Requirements](#url-requirements)
  - [Date Fields](#date-fields)
  - [Listing Pages (Item List)](#listing-pages-item-list)
  - [Summary: Key Document-Level Fields by Schema Type](#summary-key-document-level-fields-by-schema-type)
  - [Schema Types That Require No Developer Fields](#schema-types-that-require-no-developer-fields)
  - [Debugging Structured Data](#debugging-structured-data)
- [Extending the SEO Module with Custom JSON-LD Schemas](#extending-the-seo-module-with-custom-json-ld-schemas)
  - [1. Register a Custom Schema on `@apostrophecms/seo`](#1-register-a-custom-schema-on-apostrophecmsseo)
  - [2. Add the Type to the Schema Dropdown (`@apostrophecms/seo-fields-doc-type`)](#2-add-the-type-to-the-schema-dropdown-apostrophecmsseo-fields-doc-type)
  - [3. Add Fields on `@apostrophecms/doc-type`](#3-add-fields-on-apostrophecmsdoc-type)
- [Performance Optimization](#performance-optimization-1)
  - [Critical Font Preloading](#critical-font-preloading)
- [1. Place Your Fonts in a Module’s `public/` Directory](#1-place-your-fonts-in-a-modules-public-directory)
- [2. Configure the SEO Module to Preload Fonts](#2-configure-the-seo-module-to-preload-fonts)
  - [Mobile Optimization](#mobile-optimization)
- [Field Reference](#field-reference)
- [🚀 Ready for AI-Powered SEO?](#-ready-for-ai-powered-seo)
  - [✨ SEO Assistant Pro Features](#-seo-assistant-pro-features)
- [🏢 Managing Multiple Sites?](#-managing-multiple-sites)
  - [✨ Assembly Multisite Features](#-assembly-multisite-features)
- [Roadmap](#roadmap)

## Installation

```bash
npm install @apostrophecms/seo
```

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

**Important:** For proper SEO functionality, you must also configure your site's base URL. See the [Essential Configuration](#essential-configuration) section below.

## Before You Start

This module provides SEO functionality at two levels:

### ✅ Works Immediately (No Setup Required)

These features work out-of-the-box with any ApostropheCMS site:

- **Essential meta tags**: Title, description, robots
- **Analytics**: Google Analytics, Tag Manager, Site Verification
- **Site control**: Automated robots.txt and llms.txt generation
- **Basic structured data**: WebPage and CollectionPage schemas

**You can start using these features right away** - just install the module and configure your global SEO settings.

### ⚙️ Requires Content Structure Setup

Advanced structured data types need [fields with specific names](#summary-required-fields-by-schema-type) in your content types:

- **Article, Review**: Work best with author information
- **Product, HowTo**: Benefit from featured images for richer results
- **Recipe**: **Requires** a featured image (Google requirement)
- **VideoObject**: **Requires** thumbnail and upload date (Google requirement)
- **JobPosting**: Complex schema with many required fields for Google for Jobs
- **Event, LocalBusiness**: Need address/location fields
- **FAQPage, QAPage**: Need question and answer content

> [!IMPORTANT]
> ### ⚠️ Important: Field Names Must Match Expected Names for Structured Data
>
> Some structured data types **require specific field names** so that the SEO module can automatically find the right values in your documents. If your content types use different field names, and you don’t configure them accordingly, your JSON-LD may be missing required properties and **fail validation in Google’s tools**.
>
> The module also supports **fallbacks and flexible formats** (e.g., string vs. relationship fields) for authors, images, descriptions, and dates.
>
> 👉 For the full list of supported field names, fallbacks, and recommended patterns, see **[Field Flexibility](#field-flexibility)**.
>
> You can also map existing field names to required field names using the [`fieldMappings`](#custom-field-mappings) option of the module.
>
> If you plan to rely heavily on structured data (especially for products, recipes, jobs, or video), it’s a good idea to:
>
> - Design your content types with these field names in mind, or
> - Refactor existing types to match, before enabling those schema types in production.

## Core Features

### Automatic SEO Fields

![The module adds an SEO tab to your editing modals](https://static.apostrophecms.com/apostrophecms/seo/images/seo-modal.png)

The module automatically adds an "SEO" tab to all page and piece editors containing:

- **Title Tag**: Custom titles for search results (falls back to page title)
- **Meta Description**: Compelling descriptions that appear in search results
- **Robots Meta Tag**: Control search engine indexing and following behavior
- **Canonical URLs**: Prevent duplicate content penalties
- **Schema Type Selection**: Choose the appropriate structured data type for your content

### Google Analytics & Tag Manager

Built-in integration with Google Analytics, Google Tag Manager, and Google Site Verification. Simply enable the options you need and add your tracking IDs through the global configuration interface.

**Supported integrations:**
- Google Analytics (GA4) tracking
- Google Tag Manager for advanced marketing campaigns
- Google Site Verification for Search Console

See [Essential Configuration](#essential-configuration) below for setup instructions.

### Automated Robots.txt

The module automatically provides a `/robots.txt` route with strategic control over both traditional search engines and AI crawlers. Configure through global settings with five control modes:

**Available Modes:**

1. **Allow All (Search + AI)** - Default open access for all crawlers
2. **Allow Search, Block AI Training** - Maintains search rankings while protecting content from AI training by AI agents that choose to respect this standard
3. **Selective AI Crawlers** - Granular control over individual AI crawlers that support this standard
4. **Block All** - Prevents all indexing
5. **Custom** - Write your own robots.txt content

> ⚠️ Make sure that if you block all indexing during development, make sure to change the policy when you launch your final site.

**Selective Mode Crawlers:**
For fine-grained control, use Selective mode to choose specific AI crawlers. These crawlers currently indicate they honor robots.txt directives.
- **GPTBot** (OpenAI ChatGPT training)
- **ChatGPT-User** (OpenAI real-time browsing)
- **Google-Extended** (Google AI training)
- **ClaudeBot** (Anthropic AI training)
- **Claude-User** (Anthropic real-time browsing)
- **PerplexityBot** (Perplexity AI)
- **CCBot** (Common Crawl datasets)
- **Applebot-Extended** (Apple Intelligence)
- **FacebookBot** (Meta AI)
- **anthropic-ai** (Anthropic general)

Traditional search engines (Googlebot, Bingbot) are always allowed unless using "Block All" mode.

> ### ⚠️ Important Note About Robots.txt Enforcement
> The `robots.txt` standard is a **voluntary convention**, not a security mechanism.
> While the crawlers listed here currently **state that they honor `robots.txt`**, real-world behavior can differ:
>
> - Some crawlers only respect `robots.txt` in certain contexts (e.g., indexing vs. real-time browsing).
> - User-agent policies may change over time.
> - New crawlers may appear that do not publicly disclose their behavior.
>
> ApostropheCMS provides fine-grained controls for compliant crawlers, but it **cannot guarantee enforcement** against bots that ignore `robots.txt` or do not implement the standard. We recommend periodically reviewing crawler policies to ensure ongoing compliance.


**Technical Notes:**
- A physical `robots.txt` file in your `public/` directory for a single-site project, or `sites/public` and `dashboard/public` directories for multisite will override these settings
- All modes preserve traditional search engine access (except "Block All")
- See [AI & Search Strategy](#ai--search-strategy) for detailed configuration guidance

**Related:** This module also provides automated [llms.txt generation](#ai-crawler-control-llmstxt) for policy communication.

> **Note:** A global `Disallow: /` in `robots.txt` may cause some AI crawlers to skip reading `llms.txt`, depending on their behavior, but the file remains publicly accessible.

### AI Crawler Control (llms.txt)

The module automatically provides an `/llms.txt` route to communicate your AI usage policies. This is **complementary** to `robots.txt`:

- **robots.txt**: Enforceable crawler access control (blocks/allows bots)
- **llms.txt**: Informational policy declaration (informs AI systems about usage terms)

> **⚠️ Important Note:** `llms.txt` is a proposed standard that is not yet widely adopted. As of this writing, most LLMs and AI systems do not respect or read `llms.txt` files. This feature is included for forward-thinking SEO strategies and may gain broader adoption in the future. For enforceable crawler control, rely on `robots.txt` settings.

**Configuration options:**

1. **Allow AI Crawling (Default)**: Generates a comprehensive `llms.txt` file that permits responsible AI crawling with site structure information

2. **Disallow AI Training**: States content should NOT be used for AI training datasets but permits real-time search and retrieval with attribution

3. **Custom Content**: Write your own `llms.txt` policies from scratch

4. **Disabled**: Returns 404 for `/llms.txt` requests

**Best Practice:** Combine both tools strategically:
- Use **robots.txt** (Allow Search, Block AI Training mode) to technically enforce access
- Use **llms.txt** (Disallow AI Training mode) to clearly communicate your policies
- This dual approach provides both technical enforcement and clear policy communication

**What's included in the generated file:**
- Site name and description
- AI training policy (based on your selection)
- Organization information
- Links to main pages with descriptions
- Available content types
- Technical details about structured data
- Sitemap reference (if @apostrophecms/sitemap is installed)

### Sitemap Integration

Works seamlessly with `@apostrophecms/sitemap` to generate XML sitemaps that help search engines discover and index your content. The sitemap is automatically referenced in the `/llms.txt` file for AI crawlers.

### Performance Optimization

**Critical Font Preloading** - Automatically preload critical fonts to improve Core Web Vitals scores and SEO performance:
- Reduces Cumulative Layout Shift (CLS) by preventing font-loading jank
- Improves Largest Contentful Paint (LCP) with faster font rendering
- Optimizes First Contentful Paint (FCP) by eliminating render-blocking requests

Configure once in your `app.js` and the module handles the rest. See [Performance Optimization](#performance-optimization) for details.

## Essential Configuration

### Setting the Base URL

**This step is required** for proper canonical link generation and SEO performance. If using [ApostropheCMS hosting](https://apostrophecms.com/hosting), this is set automatically.

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
The base URL is automatically configured through the `baseUrlDomains` option. [Learn more about Assembly multisite hosting](https://apostrophecms.com/assembly).

### Google Analytics Integration

Enable Google Analytics tracking:

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

This adds a field in the global configuration for your Google Analytics Measurement ID (e.g., `G-XXXXXXXXXX`).

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

Add your GTM container ID (e.g., `GTM-XXXXXXX`) in the global configuration.

### Google Site Verification

Verify site ownership for Google Search Console:

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

Enter your verification meta tag content from Google Search Console in the global settings.

### Sitemap Installation

> [!TIP]
> Installations of the sitemap module is optional, but highly recommended for better search rankings

Install the companion sitemap module for XML sitemap generation:

```bash
npm install @apostrophecms/sitemap
```

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/seo': {},
    '@apostrophecms/sitemap': {}
  }
});
```

## Structured Data & Schema Types

This module generates rich structured data (JSON-LD) that helps search engines understand your content. All structured data is output in a single `<script type="application/ld+json">` tag with a `@graph` array for optimal performance.

### How It Works

The module automatically generates appropriate Schema.org markup based on the schema type you select in the SEO tab of your editor:

- **Sitewide schemas**: WebSite and Organization data from your Global settings appear on every page
- **Page-level schemas**: WebPage, CollectionPage, or your chosen primary entity type
- **Primary entities**: Article, Product, Event, Person, LocalBusiness, and more for detail pages
- **Item listings**: Automatic ItemList generation for index/listing pages

### Choosing the Right Schema

Select the schema type in the SEO tab of any page or piece editor.


### Quick Schema Selection Guide
See details for any schema below the table.

| Content Type | Recommended Schema |
|--------------|-------------------|
| Standard pages | WebPage |
| Blog index, Category pages | CollectionPage |
| Blog posts, Articles | Article |
| Product pages | Product |
| Single offers, service packages | Offer |
| Products with variants, tiered pricing | AggregateOffer |
| Event listings | Event |
| Author bios, Team pages | Person |
| Business locations | LocalBusiness |
| Job postings | JobPosting |
| Help/Support pages | FAQPage |
| Video pages | VideoObject |
| Tutorials, Guides | HowTo |
| Review articles | Review |
| Recipes | Recipe |
| Online courses | Course |


#### **Web Page**
Use for standard pages like About, Contact, or general information pages.

**Best for:** About pages, contact pages, general information pages, landing pages

---

#### **Collection Page**
Use for index and listing pages that display multiple items.

**Required fields:**
- Page title and description

**Features:**
- Automatically generates ItemList of visible items
- Toggle "Include ItemList in JSON-LD" to control ItemList output

**Best for:** Blog indexes, product catalogs, category pages, archives, search results

---

#### ItemList for Collection Pages

Collection pages (listing pages) can optionally include an **ItemList** schema in JSON-LD.
This describes the items displayed on the page (articles, products, events, etc.) and can improve how search engines understand category, listing, or archive pages.

You can enable or disable this using the **“Include ItemList in JSON-LD”** toggle in the SEO tab.

##### When you should enable ItemList
- The page is a true index/list of items
- Blog indexes, product category pages, news archives
- You want richer structured data for list/search pages

##### When you should NOT enable ItemList
- The page mixes unrelated content types
- The page is heavily personalized per user
- The listing is extremely large (hundreds+ items)
- The content shown changes frequently based on filters or user input
- It’s not actually a listing page (e.g., About, Contact)

ItemList content is generated automatically based on the items displayed by the page’s piece-page-type query (no developer configuration required).

---

#### **Article**
For blog posts, news articles, and editorial content.

**Required fields:**
- Title (from `seoTitle` or document title)
- Publication date

**Recommended fields:**
- Author
- Featured image
- Meta description

**Best for:** Blog posts, news articles, editorial content, press releases

---

#### **Product**
For e-commerce product pages with pricing and availability.

**Required fields:**
- Product name
- Price and currency

**Optional fields:**
- Brand, SKU, GTIN (barcode)
- Product condition (new, used, refurbished)
- Availability status
- Aggregate rating and review count
- Product description

**Best for:** E-commerce product pages, marketplace listings, service offerings with pricing

---

#### **Offer**
For single-price items, services, or standalone offers.

**Required fields:**
- Offer name
- Price and currency

**Optional fields:**
- Availability status (In Stock, Out of Stock, Pre-order, Discontinued, etc.)
- Valid date ranges (validFrom, priceValidUntil)
- Item condition (New, Used, Refurbished, Damaged)
- Seller information (defaults to your Organization)
- Offer URL
- Shipping details (rate, destination, delivery time)

**Best for:** 
- Individual service packages with fixed pricing
- Event tickets
- Subscription plans
- One-time purchase offers
- Limited-time deals

**SEO Impact:** Enables rich snippets showing pricing, availability, and seller info directly in search results. Improves visibility for Google Merchant Center and Shopping listings.

**Example use case:** A web design agency offering a "Starter Website Package" for $2,999 with a 30-day delivery time.

---

#### **Aggregate Offer**
For items with multiple price points, variants, or marketplace scenarios.

**Required fields:**
- Offer name
- Low price and high price
- Currency

**Optional fields:**
- Offer count (number of variants)
- Individual offers array (each with name, price, availability, URL)
- Common availability status
- Seller information

**Best for:**
- Products with size/color/material variants
- Marketplace listings from multiple sellers
- Tiered service packages (Basic, Pro, Enterprise)
- Hotel rooms with different rates
- Course offerings at different price levels
- Bulk pricing structures

**SEO Impact:** Shows price ranges in search results, helping users understand pricing options before clicking. Essential for marketplaces and products with variants.

**Example use case:** A SaaS product with Basic ($29/mo), Professional ($99/mo), and Enterprise ($299/mo) tiers.

---

#### **Event**
For concerts, webinars, conferences, and any scheduled events.

**Required fields:**
- Event name
- Start date

**Optional fields:**
- End date
- Location (name and address)
- Event description

**Best for:** Conferences, webinars, concerts, workshops, meetups, online events

---

#### **Person**
For author profiles, team member bios, and individual profiles.

**Required fields:**
- Person name

**Optional fields:**
- Job title
- Organization/employer
- Bio/description

**Best for:** Author pages, team member profiles, speaker bios, personal websites

---

#### **Local Business**
For brick-and-mortar businesses with physical locations.

**Required fields:**
- Business name

**Optional fields:**
- Address (street, city, state, zip, country)
- Phone number
- Opening hours
- Business description

**Best for:** Restaurants, retail stores, service providers, medical offices, salons

---

#### **Job Posting**
For job listings and career pages. Essential for appearing in Google for Jobs.

**Required fields:**
- Job title
- Expiration date
- Hiring organization name (falls back to global organization)
- Location (physical address or remote designation)

**Optional fields:**
- Employment type (full-time, part-time, contract, etc.)
- Salary information (range or fixed amount)
- Experience requirements (months of experience)
- Education requirements
- Skills, qualifications, responsibilities
- Benefits
- Industry and occupational category
- Work hours
- Direct apply toggle

**Best for:** Job boards, careers pages, recruitment sites, staffing agencies

**SEO impact:** Jobs appear in Google for Jobs search results with rich snippets showing salary, location, and employment type.

---

#### **FAQ Page**
For frequently asked questions pages.

**Required fields:**
- At least one question-and-answer pair

**How to use:**
1. Select **"FAQ Page"** as the schema type in the SEO tab.
2. In the **FAQ Details** section, add each question and its corresponding answer.
3. Each entry automatically generates structured data compliant with Google’s FAQPage schema.

**Best for:** Help centers, knowledge bases, product FAQ pages

**SEO impact:** Enables rich FAQ snippets in Google Search results, improving click-through rates.

#### **QA Page**
For question and answer pages where a single question has one or more answers (like Stack Overflow, forums, or community Q&A).

> [!TIP]
> The `FAQ` schema is valuable for SEO and AEO, but Google no longer shows rich search fragments from this structured data unless you are a governmental or recognized health site.

**Required fields:**
- Question title

**Optional fields:**
- Question details/body text
- Question author name
- Question date posted
- Question upvote count
- **Accepted Answer**: The answer marked as correct/most helpful
  - Answer text (required if providing accepted answer)
  - Answer author
  - Answer date
  - Answer upvote count
- **Other Answers**: Additional suggested answers
  - Each with text, author, date, and upvote count

**Best for:** Community forums, support forums, Q&A platforms, discussion boards, knowledge bases with user-contributed answers

**Difference from FAQ:**
- **FAQPage** is for curated, official FAQs written by your organization
- **QAPage** is for community-driven Q&A with voting, multiple answers, and user attribution

**SEO Impact:** Can appear in Google's Q&A rich results with voting counts, accepted answers highlighted, and author information. Helps establish expertise and community engagement.

**Example use cases:**
- Technical support forum: "How do I reset my password?" with 5 community answers
- Programming Q&A: "What's the difference between var and let in JavaScript?" with accepted answer
- Product support: Customer questions with manufacturer responses

**Best practices:**
- Always provide the accepted answer when one exists
- Include upvote counts to signal answer quality
- Add author names for credibility
- Use for pages with single questions only (not question listings)

**Note:** For question listing/index pages, use the `CollectionPage` schema instead.

#### **Video Object**
For video content pages, including educational videos and tutorials.

**Required fields:**
- Video name

**Optional fields:**
- Video description
- Upload date
- Duration (ISO 8601 format: "PT1M30S" for 1 minute 30 seconds)
- Thumbnail image (uses `_featuredImage` relationship if not specified)
- Content URL (direct video file)
- Embed URL (YouTube/Vimeo embed)

**Educational video fields:**
When "Is Educational Video" is checked, additional fields become available:
- **Educational Use**: How the video is used (assignment, professional development, continuing education, vocational training)
- **Learning Resource Type**: Type of educational content (lecture, tutorial, demonstration, presentation, exercise)

**Best for:** Video landing pages, video galleries, tutorial videos, webinar recordings, online courses, training materials

**SEO Impact:** Educational videos can appear in Google's learning-specific search features and video carousels with enhanced metadata.

**Example use cases:**
- Software tutorial: "How to Use Photoshop Layers" (learningResourceType: tutorial)
- University lecture: "Introduction to Calculus" (educationalUse: assignment)
- Professional training: "Project Management Fundamentals" (educationalUse: professional development)

#### **How To**
For step-by-step guides and tutorials.

**Required fields:**
- Guide name
- At least one step with name and instructions

**Optional fields:**
- Total time (ISO 8601 format: "PT30M" for 30 minutes)
- Supply list (materials needed)
- Tool list (tools required)
- Step images
- Guide description

**Best for:** DIY tutorials, cooking instructions, repair guides, software walkthroughs

**Example:** "How to Change a Tire," "How to Bake Sourdough Bread," "How to Install WordPress"

---

#### **Review**
For product reviews, service reviews, and editorial reviews.

**Required fields:**
- Item being reviewed (name)

**Optional fields:**
- Item type (Product, Book, Movie, Restaurant, Service)
- Rating (1-5 scale)
- Review body/text
- Author name
- Review date

**Best for:** Product review pages, service reviews, book reviews, restaurant reviews

---

#### **Recipe**
For cooking recipes and food content.

**Required fields:**
- Recipe name
- Ingredients list
- Cooking instructions

**Optional fields:**
- Author
- Prep time, cook time, total time (ISO 8601 format)
- Yield (servings)
- Recipe category (e.g., "Dessert," "Main Course")
- Cuisine type (e.g., "Italian," "Mexican")
- Nutrition information (calories, carbs, protein, fat)
- Aggregate rating and review count
- Recipe image

**Best for:** Food blogs, cooking websites, restaurant recipe pages

**Time format examples:**
- "PT30M" = 30 minutes
- "PT1H" = 1 hour
- "PT1H30M" = 1 hour 30 minutes

---

#### **Course**
For online courses and training programs.

**Required fields:**
- Course name
- Course description

**Optional fields:**
- Course provider (defaults to site organization)
- Course code (e.g., "CS101")
- Educational level (Beginner, Intermediate, Advanced)
- Price and currency
- Availability
- Aggregate rating and review count

**Best for:** Online learning platforms, training programs, educational institutions, certification courses

---

### Best Practices

**Test your markup**: Use [Google's Rich Results Test](https://search.google.com/test/rich-results) to validate your structured data

**For product catalogs:**
- Use **Product** schema on individual product detail pages
- Use **Offer** or **AggregateOffer** as the offer type within Product schema when appropriate
- Use **CollectionPage** with ItemList on category/listing pages

**For service businesses:**
- Use **Offer** schema for individual service packages
- Use **AggregateOffer** for tiered service offerings
- Combine with **LocalBusiness** for location-based services

**For marketplaces:**
- Use **AggregateOffer** to show price ranges across sellers
- Include individual offers array for each seller/variant
- Ensure seller information is populated for trust signals

**Pricing and Offers Tips:**
- Always include availability status for accurate search results
- Use priceValidUntil for time-limited offers
- Include shipping information for physical products
- Seller information automatically falls back to your global Organization settings

---

## AI & Search Strategy

Modern search and AI systems use different types of crawlers for different purposes. Understanding these differences helps you make informed decisions about your content's visibility and protection.

### Understanding Crawler Types

**Training Crawlers** (GPTBot, ClaudeBot, Google-Extended, CCBot):
- Build AI training datasets from your content
- Used to improve AI models
- Your content may be synthesized into AI responses without attribution

**Browsing Crawlers** (ChatGPT-User, Claude-User, PerplexityBot):
- Serve real-time user queries
- Typically provide attribution and links back to your site
- Drive referral traffic

**Traditional Search** (Googlebot, Bingbot):
- Power traditional search engines
- Include AI-enhanced features (Google AI Overview, Bing Chat)
- Essential for search rankings and organic traffic

### Recommended Configuration for Most Sites

For optimal search visibility while protecting intellectual property:

**robots.txt Settings:**
- Mode: **"Allow Search, Block AI Training"**

**llms.txt Settings:**
- Mode: **"Disallow AI Training"**

**Why This Works:**
- ✅ Traditional search engines continue normal indexing
- ✅ AI Overview and AI-powered search features remain functional  
- ✅ Real-time AI browsing for user queries still works
- ✅ Your content drives referral traffic from AI systems
- ❌ Your content is protected from AI training datasets
- ❌ No contribution to training commercial AI models

**Impact on Rankings:**
- **No negative impact** on Google Search rankings (confirmed by Google)
- Blocking Google-Extended does **not** affect Google Search
- AI training crawler access is completely separate from search indexing

### For Maximum AI Visibility

If you want your content widely used by AI systems for training and responses:

**robots.txt Settings:**
- Mode: **"Allow All (Search + AI)"**

**llms.txt Settings:**
- Mode: **"Allow AI Crawling"**

**Use this when:**
- You want maximum exposure in AI-generated content
- Your business model benefits from AI-driven traffic
- You're comfortable with your content training AI models
- You want to contribute to open AI datasets

### For Maximum Privacy/Protection

If you want to restrict most or all AI access:

**robots.txt Settings:**
- Mode: **"Selective AI Crawlers"**
- Check only: ChatGPT-User, Claude-User (optional - allows real-time queries)
- Or use **"Block All"** for complete restriction

**llms.txt Settings:**
- Mode: **"Disabled"**

**Use this when:**
- You have proprietary or competitive content
- Legal/compliance restrictions on AI training
- You want maximum control over content usage
- Privacy is a primary concern

### Understanding robots.txt vs llms.txt

Both tools work together but serve different purposes:

| Feature | robots.txt | llms.txt |
|---------|-----------|----------|
| **Purpose** | Enforceable crawler access control | Policy communication & transparency |
| **Technical** | Bots must respect (standard protocol) | Informational guidelines only |
| **Adoption** | Universal web standard since 1994 | **Proposed standard, limited adoption** |
| **Enforcement** | Technical blocking mechanism | **Voluntary compliance only** |
| **Controls** | Which bots can crawl your site | How content may be used if crawled |
| **Best for** | Technical access restrictions | Terms of use & AI transparency |
| **Required?** | Yes (web standard since 1994) | Optional (emerging standard) |
| **AI Support** | Most AI crawlers respect robots.txt | **Most AI systems do not read llms.txt** |
| **Example** | "Block GPTBot from accessing /api/*" | "Content may be used for search, not training" |

> **⚠️ Important:** While `llms.txt` represents forward-thinking SEO strategy, it should not be relied upon for actual crawler control. Use `robots.txt` for enforceable policies. The `llms.txt` file serves as a policy statement and may gain broader adoption over time.

**Recommended approach:** Use both together:
- **robots.txt** provides technical enforcement (works now)
- **llms.txt** clearly communicates your policies (may work in the future)

### Site Search Query Parameter

Configure the query parameter your site uses for internal search. This enables the `SearchAction` structured data in your site's WebSite schema.

**Configuration:**
Set this in your global SEO settings. Common values:
- `q` (most common) - for URLs like `/search?q=query`
- `search` - for URLs like `/search?search=query`
- `query` - for URLs like `/search?query=query`
- `s` (WordPress default) - for URLs like `/?s=query`

**Example in global settings:**
```json
"seoSearchQueryParam": "q"
```

**SEO Impact:**
This creates a SearchAction schema that:
- Helps search engines understand your site search
- May enable a "Search this site" box in Google results
- Improves your site's appearance as an authoritative source

**Note:** This should match whatever parameter your actual search functionality uses. Check your site's search URL to determine the correct value.

## Advanced Configuration

### Disabling SEO Fields

Disable SEO fields for specific page or piece types:

```javascript
// modules/my-piece-type/index.js
export default {
  extend: '@apostrophecms/piece-type',
  options: {
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


### Setting Default Schema Types

You can configure a default schema type for any piece or page type using the `seoSchemaType` option. When set, this type will be pre-selected and locked for all content of that type.

**Example configuration:**
```javascript
// modules/product/index.js
export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Product',
    seoSchemaType: 'Product'  // Always use Product schema
  }
};
```

**Pre-configured defaults:**

The following ApostropheCMS extensions automatically set appropriate schema types:

- **`@apostrophecms/blog`**: Defaults to `Article` schema for blog posts
- **`@apostrophecms/event`**: Defaults to `Event` schema for events
- The pages for each of these modules defaults the `CollectionPage` schema

When a default is configured, the schema type selector becomes read-only in the editor UI, ensuring consistency across all content of that type. These can be overridden at project level.

**When to use defaults:**

- Content types with a clear, single schema purpose (products, events, recipes)
- Ensuring editors can't accidentally select the wrong schema type
- Maintaining consistency across large content collections
- Integration with specific Schema.org requirements (e.g., job boards must use JobPosting)

### Canonical Link Configuration

Configure canonical URL options for pieces by specifying which document types editors can reference:

```javascript
// modules/article/index.js
export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    seoCanonicalTypes: [ '@apostrophecms/page', 'topic' ]
  }
};
```

This allows editors to designate another page or piece as the canonical source for search engines, helping prevent duplicate content penalties.

> **What are canonical links?** [As described on Moz.com](https://moz.com/learn/seo/canonicalization): "A canonical tag tells search engines which version of a URL you want to appear in search results." This prevents problems when identical content appears on multiple URLs.

### Pagination Support

The module **automatically** adds `rel="prev"` and `rel="next"` link tags for paginated content. No manual configuration required.

**Automatic detection works for:**

1. **Index pages** (piece-page-type listing pages):
   - Uses ApostropheCMS's built-in `req.data.currentPage` and `req.data.totalPages`
   - Automatically detects pagination from standard piece-page-type queries
   - Page 1 gets clean URLs (no `?page=1` query string)

2. **Show pages** (individual pieces with navigation):
   - Uses `req.data.next` and `req.data.previous` when configured
   - Works when you enable `next: true` and `previous: true` options on your piece-page-type

**Example piece-page-type with next/previous:**
```javascript
// modules/article-page/index.js
export default {
  extend: '@apostrophecms/piece-page-type',
  options: {
    // Enable automatic next/previous navigation
    next: true,
    previous: true
  }
};
```

**Manual override (backwards compatibility):**

If you need custom pagination logic, you can still manually set `req.data.pagination`:
```javascript
// In your route handler (only if you need custom behavior)
module.exports = {
  async index(req) {
    req.data.pagination = {
      currentPage: customPage,
      totalPages: customTotal,
      baseUrl: customBaseUrl
    };
    return {};
  }
};
```

This helps search engines understand pagination relationships and prevents duplicate content issues.

### Custom 404 Tracking

Track 404 errors in Google Analytics by adding this to your `notFound.html` template:

```nunjucks
{% block extraBody %}
  {{ super() }}
  {% include "@apostrophecms/seo:404.html" %}
{% endblock %}
```

This automatically sends 404 events when a tracking ID is configured, helping you identify broken links.


### Paywalled Content

If you mark content as paywalled, your templates must use consistent CSS classes or IDs to wrap premium content. The module needs to know which HTML element contains the paywalled content.

**How it works:**

1. Add a wrapper element around your paywalled content in your template
2. Configure the CSS selector in the SEO settings to match your wrapper

**Example template implementation:**

```nunjucks
{# views/show.html #}
<article>
  <h1>{{ data.piece.title }}</h1>
  
  {# Free preview content #}
  <div class="article-preview">
    {{ data.piece.excerpt }}
  </div>
  
  {# Paywalled content - note the class name #}
  <div class="paywall">
    {% if data.user %}
      {# Show full content to subscribers #}
      {{ data.piece.body }}
    {% else %}
      {# Show paywall message to non-subscribers #}
      <div class="paywall-notice">
        <p>Subscribe to read more...</p>
      </div>
    {% endif %}
  </div>
</article>
```

**Common CSS selector patterns:**

```css
/* By class (most common) */
.paywall
.premium-content
.members-only

/* By ID */
#paywalled-content

/* By data attribute */
[data-paywall="true"]

/* Multiple classes */
.article-body.premium
```

**In the SEO settings**, set the "Paywall CSS Selector" field to match your implementation (e.g., `.paywall`).

**Why this matters:** Google requires you to explicitly mark which parts of your page require payment. The CSS selector tells search engines exactly where the paywall boundary is, helping them show appropriate content previews without penalties.

### Custom Field Mappings

If your project uses different field names than the SEO module's defaults, you can configure custom field mappings to avoid refactoring existing content types:

```javascript
// app.js
modules: {
  '@apostrophecms/seo': {
    options: {
      fieldMappings: {
        author: 'authorName',           // Use authorName instead of author/_author
        image: 'heroImage',             // Use heroImage instead of _featuredImage
        description: 'summary',         // Use summary instead of description/excerpt
        publishedAt: 'publicationDate'  // Use publicationDate instead of publishedAt
      }
    }
  }
}
```

The module checks your custom field names first, then falls back to standard field names if the custom field is empty. This works with all field formats (strings, relationships, objects, and attachments), making it ideal for migrating from another CMS or maintaining project-specific naming conventions. Enable debug mode (`APOS_SEO_DEBUG=1`) to see which fields are being used.

> **Note:** Field mappings are global and apply to all content types. If different content types use different field names (e.g., articles use `authorName` but products use `createdBy`), use the `registerSchema()` method to create custom schema generators for those specific types instead.

## Implementation Guidelines for Developers

When using this SEO module, you have flexibility in how you structure your fields. The module supports multiple field formats through an intelligent fallback system. This section documents both the simple and advanced approaches you can take.

### Field Flexibility

The SEO module provides flexible field formats to accommodate different project needs. Whether you're building a simple blog or a complex application, you can choose the field structure that works best for your use case.

### Flexible Field Formats

#### Author Information

Provide author information in any of these formats:

**Simple string field (easiest):**
```javascript
fields: {
  add: {
    author: {
      type: 'string',
      label: 'Author Name',
      def: 'Editorial Team'
    }
  }
}
```

**Author relationship (full featured):**
```javascript
fields: {
  add: {
    _author: {
      type: 'relationship',
      withType: 'author',
      max: 1
    }
  }
}
```

**Automatic fallback:** When neither is provided, the module falls back to the user that last updated (if available).

---

#### Images

Images can be provided as:

**Simple object (for external images):**
```javascript
fields: {
  add: {
    featuredImage: {
      type: 'object',
      fields: {
        add: {
          url: { type: 'url', required: true },
          alt: { type: 'string' },
          width: { type: 'integer' },
          height: { type: 'integer' }
        }
      }
    }
  }
}
```

**ApostropheCMS image relationship (for uploaded images):**
```javascript
fields: {
  add: {
    _featuredImage: {
      type: 'relationship',
      withType: '@apostrophecms/image',
      max: 1
    }
  }
}
```

The module checks multiple field names: `_image`, `_featuredImage`, `attachment`, `featuredImage`, and `image`

---

#### Descriptions

Descriptions are automatically sourced from the first available field:

1. Schema-specific description (e.g., `product.description`)
2. `seoDescription` (SEO-optimized content)
3. `excerpt` (content preview)
4. `description` (general description)

This means you don't need to duplicate content across multiple fields.

---

#### Publication Dates

The module accepts multiple date field names:

- `publishedAt` (standard ApostropheCMS field)
- `publicationDate`
- `datePublished`
- Automatically falls back to `createdAt` if none are provided
```javascript
fields: {
  add: {
    publicationDate: {
      type: 'date',
      label: 'Publication Date'
    }
  }
}
```

---

### Debug Mode

Enable debug mode to see which fallback fields are being used:
```bash
export APOS_SEO_DEBUG=1
npm run dev
```

You'll see helpful log messages like:

```bash
[SEO] Author fallback used: document.author = "John Doe"
[SEO] Image fallback used: document.featuredImage
[SEO] Description fallback used: document.excerpt
```
---

### Featured Images

Several schema types rely on a `_featuredImage` relationship field being present on your document.

**Schema types that use featured images:**
- **Product** - Product image
- **Recipe** - Recipe photo
- **How To** - Guide illustration
- **Video Object** - Video thumbnail (falls back to featured image)

**Example implementation:**
```javascript
// modules/article/index.js
export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article'
  },
  fields: {
    add: {
      _featuredImage: {
        label: 'Featured Image',
        type: 'relationship',
        withType: '@apostrophecms/image',
        max: 1,
        required: true  // Make required if using Product or Recipe schemas
      },
    },
    group: {
      basics: {
        fields: ['title', '_featuredImage']
      }
    }
  }
};
```

**Note:** The field name **must be** `_featuredImage` (with the leading underscore) for the SEO module to find it automatically.

### Author Information

For **Article**, **Recipe**, and **Review** schemas, you can provide author information in multiple formats.

- A simple string field named `author` in the SEO schema
- A simple string field named `author` in the document schema
- A `relationship` field named `_author` that points to an “author-like” piece-type
  (for example: `author`, `person`, `staff-member`, etc.). The module reads the first relationship document’s `title` (preferred), then `name` to determine the author name.

**Resolution order:**

1. `schema.author` string (if present and non-empty)
2. `document.author` string
3. `_author` relationship: the first joined doc on `document._author`
4. `updatedBy` user on the document: `title`, then `name`

For full details on how author fields are resolved and mapped into structured data
(including fallbacks), see [Author Information](#author-information).

### URL Requirements

The `_url` property is automatically provided by ApostropheCMS for:
- All pages
- Pieces displayed through piece-page-types

No configuration required - the SEO module uses these URLs automatically for structured data.

### Date Fields

Several schema types use date information. The module looks for these fields in priority order:

1. **Publication dates:** `publishedAt`, then `createdAt`
2. **Modification dates:** `updatedAt`, then `createdAt`

**Best practice:** Add a `publishedAt` field to content types that use Article schema:

```javascript
fields: {
  add: {
    publishedAt: {
      label: 'Publication Date',
      type: 'date',
      def: null
    }
  }
}
```

### Listing Pages (Item List)

For **Collection Page** schema with Item List generation, the module automatically detects listing items from these request data properties:

- `req.data.pieces`
- `req.data.items`
- `req.data._pieces`
- `req.data.docs`

Each item must have:
- A URL: `_url` or `url` property
- A title: `seoTitle` or `title` property

**Standard piece-page-type index pages work automatically** without additional configuration.

### Summary: Key Document-Level Fields by Schema Type

Most schema types are driven primarily by their `seoJsonLd*` configuration fields  
(e.g., `seoJsonLdArticle`, `seoJsonLdProduct`, `seoJsonLdRecipe`).  
In addition, the SEO module can **reuse** certain document-level fields (outside the
`seoJsonLd*` objects) and, for some schema types, those fields are effectively
required for rich results.

The table below only lists **document-level fields** you may want to add to your
piece/page schemas. Fields that live *inside* the `seoJsonLd*` blocks (such as
`review.reviewRating`, `course.provider`, `job.baseSalary`, etc.) are documented
with each schema and are not repeated here.

| Schema Type | Suggested Document-level fields | Requirement level |
|------------------|------------------------------------------------------------------------------|-------------------|
| **Article** | **Author** → `author` (string) or `_author` (relationship)<br>**Dates** → `publishedAt` (or other mapped published date), `updatedAt` | Recommended for rich Article results (author + published date are strongly recommended) |
| **Product** | **Primary image** → `_featuredImage` (relationship), or a mapped image field used by the image fallback helper | Strongly recommended – module logs a debug warning if missing; many product rich results expect an image |
| **Recipe** | **Primary image** → `_featuredImage` (relationship) or mapped image field (resolved via image fallback helper)<br>**Author** → `author` or `_author`<br>**Dates** → `publishedAt` (or mapped) | Image is **required by the module** (no JSON-LD is emitted without one); author + published date are recommended for rich Recipe results |
| **VideoObject** | **Thumbnail fallback** → `_featuredImage` relationship (used if `seoJsonLdVideo._thumbnail` is missing)<br>**Dates** → `publishedAt` / `createdAt` (upload date fallback) | Thumbnail and upload date are **treated as required** by the module; `_featuredImage` is a practical requirement if you don’t always set `_thumbnail` |
| **HowTo** | **Top-level image** → `_featuredImage` relationship or mapped image field (via image fallback helper) | Optional in code but **strongly recommended** for rich HowTo results; step images are configured inside `seoJsonLdHowTo.steps` |
| **Review** | **Author** → `author` or `_author`<br>**Date** → `publishedAt` (or mapped) | Recommended – author and date are important for Review rich results |

> **Images and rich results:**
> The module enforces images for **Recipe** and **VideoObject** (no schema is output
> if none can be resolved). For **Product** and **HowTo**, images are not strictly
> required in code, but search engines commonly treat them as required for rich
> results. In practice, you should treat a `_featuredImage` relationship (or a
> custom-mapped image field) as required for those schema types.


### Schema Types That Require No Developer Fields

The following schema types do not depend on project-level fields. They are generated entirely from the SEO UI and built-in ApostropheCMS fields (title, URL, SEO tab configuration):

- **WebPage** – basic page metadata
- **CollectionPage** – ItemList is autogenerated from `req.data.pieces` / `items`
- **FAQPage** – uses fields in the `seoJsonLdFAQPage` UI group
- **QAPage** – uses fields in the `seoJsonLdQAPage` UI group

### Debugging Structured Data

Set the environment variable `APOS_SEO_DEBUG=1` to print JSON-LD generation diagnostics to your server logs during development. When enabled, any errors or malformed data encountered during schema generation will be logged to your server console along with the offending data payload.
This is particularly useful when testing new schema types or diagnosing missing fields in custom templates.

**Important:** Not all schema types show rich results in Google Search Console's URL Inspection Tool. The following schemas are valid and will be indexed, but may not appear in the rich results preview:

- **HowTo** - Valid schema, but not shown in URL Inspection Tool
- **QAPage** - Valid schema, but not shown in URL Inspection Tool
- **Learning Video** - Extension of VideoObject, shown as standard Video

Use the [Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/) for comprehensive testing of all schema types.

## Extending the SEO Module with Custom JSON-LD Schemas

You can add custom Schema.org types to the SEO module without modifying this package. At a high level, you will:

1. **Register** a new JSON-LD schema type on `@apostrophecms/seo`.
2. **Expose** that type in the schema type dropdown via `@apostrophecms/seo-fields-doc-type`.
3. **Add** the fields that power your schema on `@apostrophecms/doc-type`.

Apostrophe automatically merges project-level modules with the same name as core/pro modules, so you only need the right folder structure.

---

### 1. Register a Custom Schema on `@apostrophecms/seo`

Create a project-level module to register your custom Schema.org type. In this example, we’ll add a `Book` schema.

```js
// modules/@apostrophecms/seo/index.js
export default {
  init(self) {
    self.registerSchema('Book', (data) => {
      const { piece, page } = data;
      const doc = piece || page;
      const book = doc?.seoJsonLdBook;

      // Require a document and a title to emit the schema
      if (!doc || !book || !book.title?.trim()) {
        return null;
      }

      const schema = {
        '@type': 'Book',
        name: book.title
      };

      // URL / @id
      if (doc._url) {
        schema['@id'] = doc._url;
        schema.url = doc._url;
      }

      // Author
      if (book.author?.trim()) {
        schema.author = {
          '@type': 'Person',
          name: book.author
        };
      }

      // ISBN
      if (book.isbn?.trim()) {
        schema.isbn = book.isbn;
      }

      return schema;
    });
  }
};
```

The handler receives the same `data` object used to render SEO tags (`page`, `piece`, `global`, `req`, etc.). Return a JSON-LD object or `null` to skip output.

---

### 2. Add the Type to the Schema Dropdown (`@apostrophecms/seo-fields-doc-type`)

Next, make the new type available in the schema type selector. Use `extendMethods` on the `@apostrophecms/seo-fields-doc-type` module.

```js
// modules/@apostrophecms/seo-fields-doc-type/index.js
export default {
  extendMethods(self) {
    return {
      getSchemaTypeChoices(_super) {
        return function () {
          const baseChoices = _super();

          return [
            ...baseChoices,
            {
              label: 'Book',
              value: 'Book'
            }
          ];
        };
      }
    };
  }
};
```

This appends a `Book` option to the existing schema type choices. When editors select **Book** in the SEO tab, you can show Book-specific fields.

---

### 3. Add Fields on `@apostrophecms/doc-type`

Finally, define the fields that power the `Book` schema on `@apostrophecms/doc-type`. These fields will be available to all page and piece types.

```js
// modules/@apostrophecms/doc-type/index.js
export default {
  fields(self, options) {
    return {
      add: {
        seoJsonLdBook: {
          label: 'Book Details',
          type: 'object',
          help: 'Structured data fields for the Book schema.',
          if: {
            // Only show when the JSON-LD schema type is `Book`
            seoJsonLdType: 'Book'
          },
          fields: {
            add: {
              title: {
                label: 'Book Title',
                type: 'string',
                required: true
              },
              author: {
                label: 'Author',
                type: 'string'
              },
              isbn: {
                label: 'ISBN',
                type: 'string'
              }
            }
          }
        }
      },
      group: {
        seo: {
          // Add our field to the existing SEO group
          fields: [ 'seoJsonLdBook' ]
        }
      }
    };
  }
};
```

With these three pieces in place:

* Editors can select **Book** as a JSON-LD type in the SEO tab.
* A Book-specific fieldset appears when that type is selected.
* The SEO module outputs a valid `Book` JSON-LD object (including `isbn`) based on those fields.

## Performance Optimization

### Critical Font Preloading

Preload critical fonts to improve Core Web Vitals scores and SEO performance. Font loading directly impacts:
- **Cumulative Layout Shift (CLS)**: Prevents layout shift when custom fonts load
- **Largest Contentful Paint (LCP)**: Faster font loading improves render time
- **First Contentful Paint (FCP)**: Reduces render-blocking font requests

## 1. Place Your Fonts in a Module’s `public/` Directory

For cloud deployments (UploadFS → S3, GCS, etc.), fonts **must be stored inside a module**, for example:

```
modules/my-fonts/public/fonts/inter-variable.woff2
modules/my-fonts/public/fonts/geist-mono.woff
```

Apostrophe uploads assets only from module `public/` directories. These files become available at URLs like:

```
/modules/my-fonts/fonts/inter-variable.woff2
```

---
## 2. Configure the SEO Module to Preload Fonts
Configure critical fonts as a developer-level option in your `app.js`:
```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/seo': {
      options: {
        criticalFonts: [
          {
            url: '/modules/my-fonts/fonts/inter-variable.woff2',
            type: 'font/woff2'  // Optional, defaults to 'font/woff2'
          },
          {
            url: 'https://cdn.yoursite.com/fonts/geist-mono.woff',
            type: 'font/woff'
          }
        ]
      }
    }
  }
});
```

The module automatically generates `<link rel="preload">` tags for each configured font.
**Important:** Font preloading is complementary to your existing CSS - it doesn't replace it. You must still include your `@font-face` rules:

```css
/* Your existing CSS - keep this! */
@font-face {
  font-family: 'Inter';
  src: url('/modules/my-fonts/fonts/inter-variable.woff2') format('woff2');
  font-display: swap;
}
```
**How it works:**
- **Without preload**: Browser parses HTML → parses CSS → discovers font → starts download (delayed)
- **With preload**: Browser starts downloading font immediately → when CSS loads, font is already ready


The `crossorigin` attribute is automatically added for absolute URLs (CDN/external fonts) and omitted for relative URLs (self-hosted fonts).

**Where to store fonts:**

1. **Simple single-server deployments**: Place font files in `modules/my-fonts/public/fonts/` and reference them as `/modules/my-fonts/fonts/filename.woff2`
   - No CORS configuration needed for same-origin fonts
   - Works in both local and cloud/UploadFS deployments
   - Example: `{ url: '/modules/my-fonts/fonts/inter.woff2' }`

2. **CDN/S3**: Use full URLs with proper CORS headers configured on your CDN
   - Better caching and global performance
   - Requires CORS: `Access-Control-Allow-Origin: *`
   - Example: `{ url: 'https://cdn.yoursite.com/fonts/inter.woff2' }`

3. **Self-host Google Fonts instead of using their CDN**:
   - Google's CDN uses hashed URLs that make preloading impossible
   - Download Google Fonts and self-host them to enable preloading
   - Tools: [google-webfonts-helper](https://gwfh.mranftl.com/fonts) or [Google Fonts Helper](https://fonts.google.com/knowledge/using_type/self_hosting_web_fonts)
   - Once self-hosted, preload them like any other font

**Advanced options:**
```javascript
criticalFonts: [
  {
    url: '/fonts/local.woff2'
    // No crossorigin (relative URL)
  },
  {
    url: 'https://cdn.example.com/font.woff2'
    // Automatic crossorigin="anonymous" (absolute URL)
  },
  {
    url: 'https://cdn.example.com/font.woff2',
    crossorigin: false  // Explicitly disable crossorigin if needed
  },
  {
    url: 'https://private-cdn.example.com/font.woff2',
    crossorigin: 'use-credentials'  // For authenticated CDN requests
  }
]
```

**Best practices:**
- Only preload fonts used above the fold (typically 1-2 fonts maximum)
- Use `woff2` format for best compression (supported by all modern browsers)
- Ensure font files are actually available at the specified URLs before deployment
- Test with Google PageSpeed Insights to verify Core Web Vitals improvements
- Keep your existing `@font-face` CSS - preloading enhances it, doesn't replace it


**Example project structure:**
```
my-project/
├── public/
│   └── fonts/
│       ├── inter-variable.woff2
│       └── headings.woff2
└── modules/
    └── asset/
        └── ui/
            └── src/
                └── index.scss  # Reference fonts here with @font-face
```

### Mobile Optimization

The module automatically includes:
- Viewport meta tag for responsive design
- Optional theme-color meta tag for PWA compatibility
#### Theme Color for Mobile Browsers
Set a theme color for mobile browsers. Supports:
- **Single color mode** (one color for all)
- **Light/Dark mode** variants

Example configuration:
```json
{
  "mode": "lightDark",
  "light": "#ffffff",
  "dark": "#121212"
}
```

## Field Reference

|Name |Description  | Module Affected | Module Option |
--- | --- | --- | ---
|`seoTitle`|Title attribute for search results|`@apostrophecms/doc-type`|_Enabled by default_|
|`seoDescription`|Description for search results|`@apostrophecms/doc-type`|_Enabled by default_|
|`seoRobots`|Robots indexing behavior|`@apostrophecms/doc-type`|_Enabled by default_|
|`_seoCanonical`|[Canonical URL](https://moz.com/learn/seo/canonicalization) reference|`@apostrophecms/page-type`|_Enabled by default_|
|`seoGoogleTagManager`|Google Tag Manager Container ID|`@apostrophecms/global`|`seoGoogleTagManager: true`|
|`seoGoogleTrackingId`|Google Analytics Measurement ID|`@apostrophecms/global`|`seoGoogleAnalytics: true`|
|`seoGoogleVerificationId`|Google Site Verification ID|`@apostrophecms/global`|`seoGoogleVerification: true`|
|`seoJsonLdType`|Schema.org type for this document|`@apostrophecms/doc-type`|_Enabled by default_|
|`seoJsonLdProduct`|Product schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'Product'`|
|`seoJsonLdOffer`|Offer schema fields (price, availability, seller, shipping)|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'Offer'`|
|`seoJsonLdAggregateOffer`|AggregateOffer schema fields (price range, variants)|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'AggregateOffer'`|
|`seoJsonLdEvent`|Event schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'Event'`|
|`seoJsonLdPerson`|Person schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'Person'`|
|`seoJsonLdBusiness`|LocalBusiness schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'LocalBusiness'`|
|`seoJsonLdJobPosting`|JobPosting schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'JobPosting'`|
|`seoJsonLdHowTo`|How-To guide schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'HowTo'`|
|`seoJsonLdReview`|Review schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'Review'`|
|`seoJsonLdRecipe`|Recipe schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'Recipe'`|
|`seoJsonLdCourse`|Course schema fields|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'Course'`|
|`seoIncludeItemList`|Toggle ItemList in structured data|`@apostrophecms/doc-type`|Shown when `seoJsonLdType: 'CollectionPage'`|
|`seoSiteName`|Site name for WebSite schema|`@apostrophecms/global`|_Enabled by default_|
|`seoSiteDescription`|Site description for WebSite schema|`@apostrophecms/global`|_Enabled by default_|
|`seoSiteCanonicalUrl`|Base URL for structured data|`@apostrophecms/global`|_Enabled by default_|
|`seoJsonLdOrganization`|Organization schema settings|`@apostrophecms/global`|_Enabled by default_|

## 🚀 Ready for AI-Powered SEO?

**Want to supercharge your SEO workflow?** Create an account on Apostrophe Workspaces and upgrade to [**ApostropheCMS Pro**](https://app.apostrophecms.com/login). Get access to the [**SEO Assistant**](https://apostrophecms.com/extensions/seo-assistant) with AI-powered content optimization:

### ✨ SEO Assistant Pro Features
- **🤖 AI-Generated Meta Titles**: Compelling, keyword-optimized titles generated automatically
- **🔍 Smart Meta Descriptions**: AI-crafted descriptions that drive clicks
- **🎯 Content Analysis**: Get suggestions based on your actual page content
- **⚡ One-Click Optimization**: Generate, review, and apply SEO improvements instantly
- **🔄 Multiple Suggestions**: Try different approaches with regeneration options
- **✏️ Custom Prompts**: Fine-tune AI behavior for your brand voice

The SEO Assistant analyzes your page content and generates optimized meta titles and descriptions using advanced AI, making professional SEO accessible to content creators of all skill levels.

**[Contact us](https://apostrophecms.com/contact-us)** to learn more about ApostropheCMS Pro.

## 🏢 Managing Multiple Sites?

**Running multiple websites with shared content and branding?** Consider [**ApostropheCMS Assembly**](https://apostrophecms.com/assembly) for enterprise multisite management:

### ✨ Assembly Multisite Features
- **🗂️ Centralized Management**: Control multiple sites from a single dashboard
- **🚀 Shared Codebase**: Deploy updates across all sites simultaneously  
- **🌐 Multi-Domain Support**: Each site gets its own domain with automatic SSL
- **⚙️ Automatic SEO Configuration**: Base URLs and canonical links configured automatically
- **🎨 Per-Site Customization**: Individual themes, content, and settings per site
- **📊 Unified Analytics**: Track performance across your entire site network

Perfect for agencies, franchises, or organizations managing multiple branded websites.

**[Learn more about Assembly](https://apostrophecms.com/extensions/multisite-apostrophe-assembly)** or **[contact our team](https://apostrophecms.com/contact-us)**.

## Roadmap

| Feature | Status |
|---------|--------|
| SEO Meta fields for pages and pieces | ✅ Implemented |
| Google Analytics & Tag Manager integration | ✅ Implemented |
| Automated robots.txt generation | ✅ Implemented |
| Structured data (JSON-LD) for all major schema types | ✅ Implemented |
| Offer and AggregateOffer schemas | ✅ Implemented |
| SEO Assistant (AI-powered) | 🚀 Available in Pro |
| SEO Page Scanner | 🚧 Under development |

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/seo">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>
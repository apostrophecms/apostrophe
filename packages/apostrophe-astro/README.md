<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>@apostrophecms/apostrophe-astro</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
  </p>
</div>

# Astro integration for ApostropheCMS

This module integrates ApostropheCMS into your [Astro](https://astro.build/) application.

## About Astro

Astro provides a "universal bridge" to run modern frontend frameworks like React, Vue,
and SvelteJS on the server side, as well as a straightforward, JSX-like template
language of its own to meld everything together.

## Bringing ApostropheCMS and Astro together

The intent of this integration is to let Apostrophe manage content, handle routing of URLs and fetch content,
and let Astro take the responsibility for the rendering of pages
and any associated logic using your framework(s) of choice like React, Vue.js,
Svelte, etc. (see the [Astro integrations page](https://docs.astro.build/en/guides/integrations-guide/) for more).

**This module also brings the ApostropheCMS Admin UI in your Astro application**, so you can manage your site exactly as if you were in a "normal" Apostrophe instance.

When you use this module, you will have **two** projects:

1. An Astro project. This is where you write your templates and frontend code.

2. An Apostrophe project. This is where you define your page types, widget types
and other content types with their schemas and other customizations.

This kind of dual-project CMS integration is typical for Astro.

The best way to keep everything consistent is to build these in `frontend` and `backend` subdirectories of the same git repository.

To get you started quickly, we recommend one of our official Astro starter kits:

* [apostrophecms/starter-kit-astro-essentials](https://github.com/apostrophecms/starter-kit-astro-essentials) is best for a clean start with as little extra code as possible.
* [apostrophecms/starter-kit-astro-apollo](https://github.com/apostrophecms/starter-kit-astro-apollo) is a full-fledged project with a blog, a design system and other nice touches.
* [apostrophecms/starter-kit-astro-apollo-pro](https://github.com/apostrophecms/starter-kit-astro-apollo-pro) is great for those who expect to use our [Pro features](https://apostrophecms.com/pro) right away, but keep in mind you can add those modules to any project later.

> 💡 These combined Astro + Apostrophe projects are best launched by forking the repository, not using our CLI. Follow the links to see how to fork these projects and get started on your own.

You can also adapt your own existing ApostropheCMS project as explained below.

> Note that this module, `@apostrophecms/apostrophe-astro`, is meant to be installed as a dependency of your *Astro project*,
> not your Apostrophe project.

This module is currently designed for use with Astro's `output: 'server'` setting (SSR mode), so that you can edit your content
directly on the page. Support for export as a static site is under consideration for the future.

## Installation

If you did not fork the sample projects above, you will need to install this
module into your Astro project. Install this module in your
**Astro project**, not your ApostropheCMS project:

```shell
cd my-astro-project
npm install @apostrophecms/apostrophe-astro
```

*Astro 3.x and 4.x are both supported.*

## Security

You **must** set the `APOS_EXTERNAL_FRONT_KEY` environment variable to a secret
value when running your Astro project, and also set the same variable to the same value when running your Apostrophe application.
This ensures that other sites on the web cannot fetch excessive amounts of
information from ApostropheCMS without your permission.

## Configuration (Astro)

Since this is an Astro integration, you will need to add it to your Astro project's `astro.config.mjs` file.
Here is a working `astro.config.mjs` file for a project with an Apostrophe CMS backend.

```js
import { defineConfig } from 'astro/config';
import apostrophe from '@apostrophecms/apostrophe-astro';

// For production. You can use other adapters that support
// `output: 'server'`
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    apostrophe({
      aposHost: 'http://localhost:3000',
      widgetsMapping: './src/widgets',
      templatesMapping: './src/templates',
      viewTransitionWorkaround: false,
      includeResponseHeaders: [
        'content-security-policy', 
        'strict-transport-security', 
        'x-frame-options',
        'referrer-policy',
        'cache-control'
      ],
      excludeRequestHeaders: [
        // For single-site setups or hosting on multiple servers, block the host header
        'host'
      ]
      proxyRoutes: [
        // Custom URLs that should be proxied to Apostrophe.
        // Note that all of `/api/v1` is already proxied, so
        // this is usually unnecessary
      ]
    })
  ],
  vite: {
    ssr: {
      // Do not externalize the @apostrophecms/apostrophe-astro plugin, we need
      // to be able to use virtual: URLs there
      noExternal: [ '@apostrophecms/apostrophe-astro' ],
    }
  }
});
```

## Options

### `aposHost` (mandatory)  

This option is the base URL of your Apostrophe instance. It must contain the
port number if testing locally and/or communicating directly with another instance
on the same server in a small production deployment. This option can be overriden
at runtime with the `APOS_HOST` environment variable.

During development it defaults automatically to: `http://localhost:3000`

### `widgetsMapping` (mandatory)  

The file in your project that contains the mapping between Apostrophe widget types and your Astro components (see below).

### `templatesMapping` (mandatory)

The file in your project that contains the mapping between Apostrophe templates and your Astro templates (see below).

### `viewTransitionWorkaround` (optional)

If set to `true`, Apostrophe will refresh its admin UI JavaScript on
every page transition, to ensure compatibility with Astro
[view transitions](https://docs.astro.build/en/guides/view-transitions/).
If you are not using this feature of Astro, you can omit this flag to
improve performance for editors. Ordinary website visitors are
not impacted in any case. We are seeking an alternative solution to
eliminate this option.

### `includeResponseHeaders`

An array of HTTP headers that you want to include from Apostrophe to the final response sent to the browser - useful if you want to use an Apostrophe module like `@apostrophecms/security-headers` and want to keep those headers as configured in Apostrophe and to preserve Apostrophe's caching headers.

At the present time, Astro is not compatible with the `nonce` property of `content-security-policy` `script-src` value. So this is automatically removed with that integration. The rest of the CSP header remains unchanged.

### `excludeRequestHeaders`

An array of HTTP headers that you want to prevent from being forwarded from the browser to Apostrophe. This is particularly useful in single-site setups where you want to block the `host` header to allow Astro and Apostrophe to run on different hostnames.

By default, all headers are forwarded except those specified in this array.

### `forwardHeaders` (deprecated)

This option has been replaced by `includeResponseHeaders` which provides clearer naming for its purpose. If both options are provided, `includeResponseHeaders` takes precedence. `forwardHeaders` will be removed in a future version.

### Mapping Apostrophe templates to Astro components

Since the front end of our project is entirely Astro, we'll need to create Astro components corresponding to each
template that Apostrophe would normally render with Nunjucks.

Create your template mapping in `src/templates/index.js` file.
As shown above, this file path must then be added to your `astro.config.mjs` file,
in the `templatesMapping` option of the `apostrophe` integration.

```js
// src/templates/index.js
import HomePage from './HomePage.astro';
import DefaultPage from './DefaultPage.astro';
import BlogIndexPage from './BlogIndexPage.astro';
import BlogShowPage from './BlogShowPage.astro';
import NotFoundPage from './NotFoundPage.astro';

const templateComponents = {
  '@apostrophecms/home-page': HomePage,
  'default-page': DefaultPage,
  '@apostrophecms/blog-page:index': BlogIndexPage,
  '@apostrophecms/blog-page:show': BlogShowPage,
  '@apostrophecms/page:notFound': NotFoundPage
};

export default templateComponents;
```

#### How Apostrophe template names work

For ordinary page templates, like the home page or a typical "default" page type
in an Apostrophe project, you can just specify the Apostrophe module name.

For special templates like `notFound`, and for modules that serve more than one
template, you'll need to specify the complete name. For instance, Apostrophe's
`@apostrophecms/blog` module contains an `@apostrophecms/blog-page` page type
that renders an `index` template when viewing the main page of the blog, and
a `show` template when viewing a single blog post (a "permalink" page).

If you don't specify the template name, `:page` is assumed, which is just right
for ordinary page types.

For the "404 Not Found" page, use `@apostrophecms/page:notFound`, which is
the standard name for this template in ApostropheCMS.

#### Special template names

The integration comes with two additional special template names that can be mapped to Astro templates.
You should not add a module name to these special names:

* `apos-fetch-error`: served when Apostrophe generates a 500-class error. The integration will set Astro's response status to 500.
* `apos-no-template`: served when there is no mapping corresponding to the Apostrophe page type for this page.

See below for an example Astro template for the `@apostrophe-cms/home-page` type. But first,
let's look at widgets.

### Mapping Apostrophe widgets to Astro components

Similar to Astro page components, Astro widget components replace Apostrophe's usual
widget rendering.

Create your template mapping in a file in your application, for example in a
`src/widgets/index.js` file. This file path must then be added to your `astro.config.mjs` file,
in the `widgetsMapping` option of the `apostrophe` integration, as seen above.

```js
// src/widgets/index.js

import RichTextWidget from './RichTextWidget.astro';
import ImageWidget from './ImageWidget.astro';
import VideoWidget from './VideoWidget.astro';
import LayoutWidget from '@apostrophecms/apostrophe-astro/widgets/LayoutWidget.astro';
import LayoutColumnWidget from '@apostrophecms/apostrophe-astro/widgets/LayoutColumnWidget.astro';

const widgetComponents = {
  // Standard widgets, but we must provide our own Astro components for them
  '@apostrophecms/rich-text': RichTextWidget,
  '@apostrophecms/image': ImageWidget,
  '@apostrophecms/video': VideoWidget,
  '@apostrophecms/layout': LayoutWidget,
  '@apostrophecms/layout-column': LayoutColumnWidget
};

export default widgetComponents;
```

> Note that even basic widget types like `@apostrophecms/image` do need an Astro
template in your project. This integration does not currently ship with built-in
Astro templates for all of the common Apostrophe widgets. However, all of the starter kits referenced in this document include all the necessary code for the most common core widgets.

Note that the Apostrophe widget name (on the left) is the name of your widget module **without**
the `-widget` part.

> [!TIP]
> The `@apostrophecms/layout-widget` needs some extra configuration and addition to areas in your ApostropheCMS project. You can read more in the [documentation](https://docs.apostrophecms.org/guide/core-widgets.html#layout-widget).

The naming of your Astro widget templates is up to you. The above convention is just
a suggestion.

### Creating the `[...slug.astro]` component and fetching Apostrophe data

Since Apostrophe is responsible for managing URLs to content, including creating new content and pages
on the fly, you will only need one top-level Astro page component: the `[...slug].astro` route.

The integration comes with an `aposPageFetch` method that can be used to automatically
fetch the relevant data for the current URL.

Your `[...slug].astro` component should look like this:

```js
---
import aposPageFetch from '@apostrophecms/apostrophe-astro/lib/aposPageFetch.js';
import AposLayout from '@apostrophecms/apostrophe-astro/components/layouts/AposLayout.astro';
import AposTemplate from '@apostrophecms/apostrophe-astro/components/AposTemplate.astro';

const aposData = await aposPageFetch(Astro.request);
const bodyClass = `myclass`;

if (aposData.redirect) {
  return Astro.redirect(aposData.url, aposData.status);
}
if (aposData.notFound) {
  Astro.response.status = 404;
}
---
<AposLayout title={aposData.page?.title} {aposData} {bodyClass}>
    <Fragment slot="standardHead">
      <meta name="description" content={aposData.page?.seoDescription} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charset="UTF-8" />
    </Fragment>
    <AposTemplate {aposData} slot="main" />
</AposLayout>
```

Thanks to the `aposPageFetch` call, the `aposData` object will then contain all of
the information normally provided by `data` in an ApostropheCMS Nunjucks template.
This includes, but is not limited to:

* `page`: the page document for the current URL, if any
* `piece`: the piece document when on a "show page" for a piece page type
* `pieces`: an array of pieces when on an "index page" for a piece page type
* `user`: information about the currently logged-in user
* `global`: the ApostropheCMS global document e.g. global settings, editable global
headers and footers, etc.
* `query`: the `req.query` object, giving access to query parameters in the URL.

Any other data that your custom Apostrophe code attaches to `req.data` is also
available here.

#### Understanding `AposLayout`

This integration comes with a full managed global layout, replacing the `outerLayout.html`
used in Nunjucks page templates.

In your `[...slug].astro` file, use the `AposLayout` component built into this
integration to leverage the global layout.

To override any aspect of the global layout, take advantage of the following Astro slots,
which are closely related to what ApostropheCMS offers in Nunjucks:

* `startHead`: slot in the very beginning of the `<head>`
* `standardHead`: slot in the middle of `<head>`, just after `<title>`  
* `extraHead`: still in the HTML `<head>`, at the very end
* `startBody`: at the very beginning of the `<body>` - this is not part of the refresh zone in edit mode
* `beforeMain`: at the very beginning of the main body zone - part of the refresh zone in edit mode
* `main`: the inner part of the main body zone - part of the refresh zone in edit mode
* `afterMain`: at the very end of the main body zone - part of the refresh zone in edit mode
* `endBody`: at the very end of the `<body>` - this is not part of the refresh zone in edit mode

In addition, the `AposLayout` component expects four props:

* `aposData`: the data fetched from Apostrophe
* `title`: this will go in the `<title>` HTML tag
* `lang` which will be set in the `<html>` `lang` attribute
* `bodyClass`: this will be added in the `class` attribute of the `<body>` element

This layout component will automatically manage the switch between support for
the editing UI if a user is logged in and a simpler "Run Layout" for all other
page requests.

#### Understanding `AposTemplate`

The role of `AposTemplate` is to automatically find the right Astro component
to render based on the template mapping you created earlier. It accepts one
prop, the full `aposData` object.

### Creating Astro page components

Next we'll look at how to write Astro page components, such as the
`src/templates/HomePage.astro` file mentioned above.

> We do not recommend placing these in `src/pages` because their names are not
> routes and Astro should not try to compile them as routes. Place them in
> `src/templates` instead. `src/pages` should only contain the `[...slug.astro]` file.

As an example, let's take a look at a simple home page template:

```js
---
// src/templates/HomePage.astro
import AposArea from '@apostrophecms/apostrophe-astro/components/AposArea.astro';
const { page } = Astro.props.aposData;
const { main } = page;
---

<section>
  <h1>{ page.title }</h>
  <AposArea area={main} />
</section>
```

Notice that we receive the `page` object from Apostrophe, which gives us
access to `page.title`. This is similar to `data.page` in a Nunjucks template.

#### Understanding the `AposArea` component

This component allows Astro to render Apostrophe areas, and provides a
standard Apostrophe editing experience when doing so. Astro will automatically
call our widget components once content exists in the area. All we have to do is
pass on the area object, in this case the `main` schema field of `page`.

Note that we can also pass area objects that are schema fields of widgets.
This allows for nested widgets, such as multiple-column widgets often used
for page layout.

Note that additional props can be passed to the `AposArea` component and will be made
accessible to widget components.

### Creating Astro widget components

Earlier we created a mapping from Apostrophe widget names to Astro components.
Let's take a look at how to implement these.

You Astro widget will receive a `widget` property, in addition to any custom props
you passed to the `AposArea` component. This `widget` property contains the
the schema fields of your Apostrophe widget.  

As an example, here is a simple Astro component to render `@apostrophecms/image` widgets:

```js
---
const { widget } = Astro.props;
const placeholder = widget?.aposPlaceholder;
const src = placeholder ?
  '/images/image-widget-placeholder.jpg' :
  widget?._image[0]?.attachment?._urls['full'];
---
<style>
  .img-widget {
    width: 100%;
  }
</style>
<img class="img-widget" {src} />
```

#### Placeholders are important in widgets that use them

Why are we checking for `aposPlaceholder`? Apostrophe's `@apostrophecms/image`
widget displays a placeholder image until the user clicks the edit pencil to
select their image of choice. When rendered by Astro, Apostrophe still expects
this to be the case. So we need to provide our own placeholder rendering.

In this case, a suitably named file must exist in `public/images` in our Astro project.

#### Remember, relationship properties might not be populated

It is always possible that the image associated with an image widget has
been archived. The `?.` syntax is a simple way to avoid a 500 error
in such a situation. You may wish to add a more sophisticated fallback.

### Accessing image and URLs

Properties like `.attachment._urls['full']` exist on all image pieces,
while properties like `.attachment._url` exist on non-image attachments
such as PDFs. For more information, see
the [attachment field format](https://v3.docs.apostrophecms.org/reference/api/field-formats.html#attachment).

## What to change in your Apostrophe project

Nothing! Well, almost.

* Your project must be using Apostrophe 4.x.
* You'll need to `npm update` your project to the latest version of `apostrophe`.
* You'll need to set the `APOS_EXTERNAL_FRONT_KEY` environment variable to a secret
value of your choosing when running Apostrphe.
* Make sure you set that **same value** when running your Astro project.
* To avoid developer confusion, we recommend changing any page templates in your
Apostrophe project to provide a link to your Astro frontend site and
remove all other output. Everyone, editors included, should go straight to Astro.

## Starting up your combined project

To start your Astro project, follow the usual practice:

```bash
cd my-astro-project
npm install
export APOS_EXTERNAL_FRONT_KEY=your-secret-goes-here
npm run dev
```

In an adjacent terminal, start your Apostrophe project:

```bash
cd my-apostrophe-project
npm install
export APOS_EXTERNAL_FRONT_KEY=your-secret-goes-here
npm run dev
```

For convenience, Astro generally defaults to port `4321`, while
Apostrophe defaults to port `3000`.

## Logging in

Once your integration is complete, you will be able to reach the login page in
the usual way at `http://localhost:4321/login`. Astro proxies this route directly
to Apostrophe. Therefore any additional extensions you have added such as
Apostrophe's hCaptcha and TOTP modules will work as expected.

## Redirections

When Apostrophe sends a response as a redirection, you will receive a specially
formatted `aposData` object containing `redirect: true`, a `url` property for the url
to redirect to, and a `status` for the redirection HTTP status code. This is handled
in the earlier example, repeated here for convenience:

```js
const aposData = await aposPageFetch(Astro.request)
// Redirect
if (aposData.redirect) {
  return Astro.redirect(aposData.url, aposData.status);
}
```

## 404 Not Found

Much like the redirect case, when Apostrophe determines that the page was not
found, `aposData.notFound` will be set to true. The example `[...slug].astro`
file provided above includes logic to set Astro's status code to 404 in this
situation.

## Reserved routes

As this integration proxies certain Apostrophe endpoints, there are some routes that are taken by those endpoints:

* `/apos-frontend/[...slug]` for serving Apostrophe assets
* `/uploads/[...slug]` for serving Apostrophe uploaded assets
* `/api/v1/[...slug]` and `/[locale]/api/v1/[...slug]` for Apostrophe API endpoints
* `/login` and `/[locale]/login` for the login page

As all Apostrophe API endpoints are proxied, you can expose new api routes as usual in your Apostrophe modules, and be able to request them through your Astro application.
Those proxies are forwarding all of the original request headers, such as cookies, so that Apostrophe login works normally.

## What about widget players?

ApostropheCMS is very unopinionated on the front end, but it does include one
important front end feature: widget players. These provide a way for developers
to provide special behavior to widgets, calling each widget's player exactly
once at page load and when new widgets are inserted or replaced with new values.
Users appreciate this and expect interactive widget features to work normally
without a page refresh, even if the widget was just added to the page.

In Astro, web components are a recommended strategy to achieve the same thing.
Defining and using a web component in an Astro widget component has much
the same effect as defining a widget player in a standalone Apostrophe project.

Here is a simple outline of such a web component. For a complete example of
the same widget, check out the source code of `VideoWidget.astro` in our
[Astro Essentials Starter Kit](https://github.com/apostrophecms/starter-kit-astro-essentials/blob/main/frontend/src/widgets/VideoWidget.astro) project.

```js
---
// src/widgets/VideoWidget.astro
const { widget } = Astro.props;
const placeholder = widget?.aposPlaceholder ? 'true' : '';
const url = widget?.video?.url;
---
<style>
  video-widget {
    width: 100%;
  }
</style>
<video-widget
  url={placeholder ? 'https://youtu.be/Q5UX9yexEyM' : url }
>
</video-widget>
<script>
  class VideoWidget extends HTMLElement {
    constructor() {
      super();
      this.init();
    }
    async init() {
      const videoUrl = this.getAttribute('url');
      // Your logic here!
      //
      // Fetch details about the video URL,
      // create an iframe to embed it, append it
      // to the component's HTML element with this.append(),
      // etc.
    }
  }
  customElements.define('video-widget', VideoWidget);
</script>
```

> Note that Astro script tags aren't really plain vanilla HTML script tags.
> They are efficiently compiled, support TypeScript and are only executed
> once even if the component appears may times on the page. Defining a
> web component allows us to leverage that code more than once by using
> the newly defined element as often as we wish.

## `aposSetQueryParameter`: working with query parameters

One last thing: query parameters. Sometimes we want to create pagination
links with page numbers, add filters to a URL's query string, and so on.
But, working with query parameters coming from Apostrophe can
be a little bit tricky because there are often special query parameters
present during editing that should not be part of a visible URL.

As a convenience, Apostrophe provides `aposSetQueryParameter` to abstract
all that away.

Here is how the `BlogIndexPage.astro` component of the
[Starter Kit Astro Essentials](https://github.com/apostrophecms/starter-kit-astro-essentials/blob/main/frontend/src/templates/BlogIndexPage.astro) project generates
links to each page of blog posts:

```js
---
import setParameter from '@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter.js';

const {
  pieces,
  currentPage,
  totalPages
} = Astro.props.aposData;

const pages = [];
for (let i = 1; (i <= totalPages); i++) {
  pages.push({
    number: i,
    current: page === currentPage,
    url: setParameter(Astro.url, 'page', i)
  });
}
---

<section class="bp-content">
  <h1>{ page.title }</h1>

  <h2>Blog Posts</h2>

  {pieces.map(piece => (
    <h3>
      <a href={ piece._url }>{ piece.title }</a>
    </h3>
  ))}

  {pages.map(page => (
    <a
      class={(page === currentPage) ? 'current' : ''} 
      href={page.url}>{page.number}
    </a>
  ))}
</section>
```

Imported here as `setParameter`, `aposSetQueryParameter` allows
us to do two things:

1. Take a URL and return a new URL with a certain query parameter set
to a new value.
2. Remove a query parameter completely by passing the empty string as
a value, or by passing `null` or `undefined`.

While you can get the same result by manipulating `Astro.url` yourself,
you'll be able to avoid the confusing presence of query parameters
like `aposMode` by using this convenient feature.

## What about Vue, React, SvelteJS, etc.?

While not shown directly in the examples above, **Astro can import components
written in any of these frameworks.** Just use `astro add` to install
the appropriate integration, then `import` your components freely in your
`.astro` files. For complete documentation and examples, see the
[`@astrojs/react` integration](https://docs.astro.build/en/guides/integrations-guide/react/).

In this way, Astro acts as a **universal bridge** to essentially all modern
frontend frameworks.

## A note on production use

For production use, any Astro hosting adapter that supports `mode: 'server'` should
be acceptable. In particular, our [Starter Kit Astro Essentials](https://github.com/apostrophecms/starter-kit-astro-essentials) project comes pre-configured
for the `node` adapter, and includes `npm run build` and `npm run serve`
support to take advantage of that. In `server` mode there is not a great
deal of difference between these and `npm run dev`, but there is less
overhead and less information exposed to the public, so we recommend following
this best practice.

## Debugging

In most cases, Astro prints helpful error messages directly in the browser
when in a development environment.

However, if you receive the following error:

```
Only URLs with a scheme in: file and data are supported by the default ESM
loader. Received protocol 'virtual:'
```

Then you most likely left out this part of the above `astro.config.mjs` file:

```javascript
export default defineConfig({
  // ... other settings above here ...
  vite: {
    ssr: {
      // Do not externalize the @apostrophecms/apostrophe-astro plugin, we need
      // to be able to use virtual: URLs there
      noExternal: [ '@apostrophecms/apostrophe-astro' ],
    }
  }
});
```

Without this logic, the `virtual:` URLs used to access configuration information
will cause the build to fail.

## Enabling the `render-area` option to ApostropheCMS REST APIs

In order to enable section template library previews, and also unlock the `?render-area=1` and `?render-area=inline` query parameters to ApostropheCMS REST APIs in general, you'll need to add the following route:

```markup
---
// Place this file in: src/pages/api/apos-external-front/render-area.astro

import AposRenderAreaForApi from '@apostrophecms/apostrophe-astro/components/AposRenderAreaForApi.astro';
---
<AposRenderAreaForApi />
```

This file provides a "bridge" between ApostropheCMS and Astro, allowing ApostropheCMS to "call back" to the Astro project to render the content for a particular area.

Our recently updated starter kits already include this file.

## Enabling the `@apostrophecms/layout-widget` in an existing project
If you are using any of our starter kits, or you are following the integration steps outlined above, you will have the core layout-widget installed. For existing projects you will have a few steps to activate it.

### Backend updates
1. Add `@apostrophecms/layout` to any areas where you will want to add the widget.

By default, the layout widget columns will include the core rich-text, image, and video widgets. If you want any additional widget types, you will have to follow several additional steps:

1. Create a `backend/modules/@apostrophecms/layout-column-widget/index.js` file.
2. Add the following code:
```javascript
export default {
  fields(self, options) {
    return {
      add: {
        content: {
          type: 'area',
          label: 'Main Content',
          options: {
            widgets: {
              // add any project-specific content widgets
              // nesting layout widgets can lead to poor performance
              // or rendering issues
              '@apostrophecms/rich-text': {},
              '@apostrophecms/image': {},
              '@apostrophecms/video': {}
            }
          }
        }
      }
    };
  }
};
```

This file extends the default column widget to define which content widgets editors can add inside each column. Avoid nesting layout widgets inside other layouts to prevent excessive DOM complexity and performance issues.

> [!TIP]
> You can read more about configuring and using the layout-widget in the [documentation](https://docs.apostrophecms.org/guide/core-widgets.html#layout-widget).

### Frontend updates
The `@apostrophecms/apostrophe-astro` package contains templates for the layout widget and column, but like the other widgets, they have to be mapped to the corresponding Apostrophe widgets.

1. Open the `frontend/src/widgets/index.js` file.
2. Import the `layout` and `layout-column` widgets
  ``` javascript
    import LayoutWidget from '@apostrophecms/apostrophe-astro/widgets/LayoutWidget.astro';
    import LayoutColumnWidget from '@apostrophecms/apostrophe-astro/widgets/LayoutColumnWidget.astro';
  ```
3. Map the components in the `widgetComponents` object
  ``` javascript
    export const widgetComponents = {
    ...widgetComponents,
    '@apostrophecms/layout': LayoutWidget,
    '@apostrophecms/layout-column': LayoutColumnWidget
  };
  ```
Once you’ve added these mappings, restart your Apostrophe server and refresh the editor. The layout widget should now appear as an option in any area that includes @apostrophecms/layout.

## Conclusion

This module provides a new way to use ApostropheCMS: as a back end
for modern front end development in Astro. But more than that, it
provides a future-proof bridge to many different front-end frameworks.

Also important, Apostrophe fully maintains the on-page, in-context editing
experience when integrated with Astro, going beyond "side-by-side"
editing experiences to achieve integration close enough that we often
have to look at the address bar to know whether we are looking at
Astro or Apostrophe.

That being said, this integration is also new, and we encourage you
to share your feedback.

## Acknowledgements

Development of this module began with Stéphane Maccari and Clément Ravier of
Michelin. We are grateful for their generous support of ApostropheCMS.

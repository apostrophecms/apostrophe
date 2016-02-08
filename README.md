[![Build Status](https://travis-ci.org/punkave/apostrophe.svg?branch=unstable)](https://travis-ci.org/punkave/apostrophe)

# How to make a website with Apostrophe 0.6 unstable

We'll assume our project's short, filename-friendly name is `straw-man`.

Check out Apostrophe 0.6 unstable:

```
mkdir -p ~/src
cd ~/src
git clone -b unstable https://github.com/punkave/apostrophe apostrophe-06
cd apostrophe-06
npm install
```

Now create your project and manually add a symbolic link to Apostrophe 0.6 unstable:

```
cd ~/Sites
mkdir straw-man
cd straw-man
git init
npm init
mkdir -p node_modules
cd node_modules
ln -s ~/src/apostrophe-06 apostrophe
```

Next we'll create `app.js`. We need to initialize Apostrophe and let it know our short name, which will be the name of the mongodb database as well:

```javascript
var apos = require('apostrophe')({
  shortName: 'straw-man'
});
```

Now create a folder to store our page templates:

```
mkdir -p lib/modules/apostrophe-pages/views/pages
```

Next, create the home page template, `lib/modules/apostrophe-pages/views/pages/home.html`. We'll incorporate an editable area that allows slideshows and rich text:

```html
{% extends data.outerLayout %}
{% block title %}Home{% endblock %}
{% block main %}

<h2>Welcome to Straw Man, Inc.</h2>

{{
  apos.area(data.page, 'body', {
    widgets: {
      'apostrophe-rich-text': {
        toolbar: [ 'Bold', 'Italic', 'Link', 'Anchor', 'Unlink' ]
      },
      'apostrophe-images': { size: 'one-half' }
    }
  })
}}

{% endblock %}
```

Note that we're extending a layout template here, which saves us from reimplementing shared elements in every page template. We'll look at that later.

Now we need to create the database, which will automatically populate the site with a home page. To list the command line tasks we type:

`node app help`

Which reveals:

```
The following tasks are available:

apostrophe-db:reset
apostrophe:generation
apostrophe-pages:unpark
apostrophe-users:add
```

Let's reset the database. (*Never do this to a site with existing content you want to keep.*)

```
node app apostrophe-db:reset
```

At this point we can launch the site and view the home page:

```
node app
```

Now visit `http://localhost:3000/` to see the site.

But we can't log in yet because there is no admin user yet. Users get their permissions via "groups," which make it easy to configure a lot of users with the same permissions. So hit control-C and let's expand `app.js` to configure some groups:

```javascript
var apos = require('apostrophe')({
  shortName: 'straw-man',
  modules: {
    'apostrophe-users': {
      groups: [
        {
          title: 'Guest',
          permissions: [ ]
        },
        {
          title: 'Editor',
          permissions: [ 'edit' ]
        },
        {
          title: 'Admin',
          permissions: [ 'admin' ]
        }
      ]
    }
  }
});
```

*From now on I won't show all of `app.js` every time I show you something to add to it.*

Now we can add an admin user:

```
node app apostrophe-users:add admin Admin
```

You'll be prompted for a password.

Now start the site again:

```
node app
```

*From now on I'll assume you know how to restart the site. Press control-C to stop the site.*

Let's log in:

`http://localhost:3000/login`

After logging in the home page appears again, this time with an editing interface. Try adding rich text items and slideshows. Whoa, the controls are all on top of what we're trying to do! We'll be improving that, but for now let's use it as an example of how to add CSS to our project.

## Stylesheets

We need some styles. By default the interface buttons are very much on top of our work. A good time to show how to add a stylesheet of your own.

Configure the `apostrophe-assets` module in `app.js` (add it inside the `modules` property):

```javascript
apostrophe-assets: {
  stylesheets: [
    {
      name: 'site'
    }
  ]
}
```

Now create a folder for the LESS CSS files:

`mkdir -p lib/modules/apostrophe-assets/public/css`

And populate `site.less` in that folder:

```css
.apos-refreshable {
  margin-top: 150px;
}

.apos-rich-text {
  padding-top: 120px;
}
```

Restart the site and refresh the page. Now you can see what you're doing!

Similarly, we can push javascript files via the `scripts` key and the `public/js` folder in the `apostrophe-assets` module.

## Adding pages

We want to be able to have more than one page on our site. The "New Page" option on the "Page Menu" doesn't work yet because we haven't configured any page types. Each type corresponds to a template, such as our `home` template.

Let's configure the `apostrophe-pages` module:

```javascript
'apostrophe-pages': {
  types: [
    {
      name: 'default',
      label: 'Default'
    },
    {
      name: 'home',
      label: 'Home'
    }
  ]
},
```

And create a template for `default` pages in `lib/modules/apostrophe-pages/views/pages/default.html`:

```html
{% extends data.outerLayout %}
{% block title %}{{ data.page.title }}{% endblock %}
{% block main %}

<h2>{{ data.page.title }}</h2>

{{
  apos.area(data.page, 'body', {
    widgets: {
      'apostrophe-rich-text': {
        toolbar: [ 'Bold', 'Italic', 'Link', 'Anchor', 'Unlink' ]
      },
      'apostrophe-images': { size: 'one-half' }
    }
  })
}}

{% endblock %}
```

It's similar to the home page, but displays the title of this particular page.

Now you can access "New Page" from the "Pages Menu."

## Editing the layout and adding navigation

Now that we have subpages on the site, we need a way to navigate to them. Let's add a breadcrumb trail and a subnav of child pages to every page.

We'll want these things to be in the shared layout template that all page templates extend. That's called `outerLayout.html`. By default it's an empty template that just extends `outerLayoutBase.html` and outputs whatever is in your page template. `outerLayoutBase.html` does the really gnarly work of outputting `link` and `script` tags and the Apostrophe admin bar. In some projects you may never touch that one.

To override it for your project, create `lib/modules/apostrophe-templates/views/outerLayout.html` in your project. First make the folder:

```
mkdir -p lib/modules/apostrophe-templates/views
```

*You can override any template that is part of an Apostrophe module by creating a corresponding `views` folder in your project. Apostrophe's modules live in the `lib/modules` folder of the `apostrophe` npm module. If you recreate the same folder structure in your project, you can override individual template files by copying and modifying them there. Never edit the templates in `node_modules/apostrophe` itself to do project-specific work.*

Here's an example of an `outerLayout.html` that includes "tabs" (children of the home page), a breadcrumb trail (links to ancestor pages), and subnavigation with links to child pages. With these links we can explore the whole site and come back again.

We'll also open a `<main>` element to contain the content from the page template.

```html
{% extends "outerLayoutBase.html" %}
{% block beforeMain %}

  <nav class="tabs">
    {# If we have ancestors, the first one is the home page. Otherwise, we are the home page #}
    {% set home = data.page._ancestors[0] or data.page %}
    {% for page in home._children %}
      {# If this tab is the current page or its second ancestor, it's the current tab #}
      {% set current = (data.page._id == page._id) or (data.page._ancestors[1]._id == page._id) %}
      <a href="{{ page._url }}" class="{% if current %}current{% endif %}">{{ page.title }}</a>
    {% endfor %}
  </nav>

  <nav class="breadcrumb">
    {% for page in data.page._ancestors %}
      <a href="{{ page._url }}">{{ page.title }}</a> &raquo;
    {% endfor %}
    <a class="self" href="{{ data.page.url }}">{{ data.page.title }}</a>
  </nav>

  <nav class="children">
    {% for page in data.page._children %}
      <a href="{{ page._url }}">{{ page.title }}</a>
    {% endfor %}
  </nav>
  <main>
{% endblock %}

{% block afterMain %}
  </main>
{% endblock %}
```

*The `beforeMain` and `afterMain` blocks defined in `outerLayoutBase.html` are useful for doing things before and after the main content from the page template. You can also override `outerLayoutBase.html` completely if you don't like this structure.*

*"What's with all the underscores?"* Properties like `_children` and `_ancestors` are loaded dynamically, depending on what pages this page is currently related to. Apostrophe uses the `_` notation to indicate that they should not be redundantly stored back to the database.

Here are some additional styles for `site.less` to make the site a little more recognizable in structure once you've added some pages and subpages and so on:

```css
/* quick and dirty LESS CSS for navigation */

nav.tabs {
  margin-left: 220px;
  a {
    display: inline-block;
    padding: 10px;
    border: 1px solid gray;
    &.current {
      border-bottom: 1px solid white;
    }
  }
}

nav.breadcrumb {
  margin-left: 220px;
  margin-top: 20px;
  a {
    display: inline-block;
  }
  padding-bottom: 40px;
  .self {
    font-weight: bold;
  }
}

nav.children {
  margin-top: 20px;
  float: left;
  width: 200px;
  padding-right: 20px;
  a {
    display: block;
  }
}

main {
  margin-left: 220px;
  width: 1000px;
}
```

## Blogging

We want a blog. We don't have an official blog module yet, but we do have `apostrophe-pieces`, a parent class for all modules that manage global silos of content, such as blog posts. Let's subclass it to add blog posts to the project.

We could do this right in `app.js`, but because we'll be writing some code, it makes more sense to create a new folder for the module:

```
mkdir -p lib/modules/blog-posts
```

Now create `index.js` in that file:

```javascript
module.exports = {
  extend: 'apostrophe-pieces',
  name: 'blogPost',
  label: 'Blog Post',
  addFields: [
    {
      name: 'publicationDate',
      label: 'Publication Date',
      type: 'date'
    },
    {
      name: 'publicationTime',
      label: 'Publication Time',
      type: 'time',
      required: false,
      def: null
    },
    {
      name: 'body',
      label: 'Body',
      type: 'area',
      options: {
        widgets: {
          'apostrophe-rich-text': {
            toolbar: [ 'Style', 'Bold', 'Italic', 'Link', 'Anchor', 'Unlink' ]
          },
          'apostrophe-images': { size: 'one-half' }
        }
      }
    }
  ],

  construct: function(self, options) {

    // When a blog post is saved in the editor, update the sorting-friendly
    // publishedAt field based on publicationDate and publicationTime
    self.beforeSave = function(req, doc, callback) {
      if (doc.type !== self.name) {
        return setImmediate(callback);
      }
      if (doc.publicationTime === null) {
        // Make sure we specify midnight, if we leave off the time entirely we get
        // midnight UTC, not midnight local time
        doc.publishedAt = new Date(doc.publicationDate + ' 00:00:00');
      } else {
        doc.publishedAt = new Date(doc.publicationDate + ' ' + doc.publicationTime);
      }
      return setImmediate(callback);
    };

    // Override "find" and set a default sort based on publication date/time, typical for blogs
    var superFind = self.find;
    self.find = function(req, criteria, projection) {
      var cursor = superFind(req, criteria, projection);
      cursor.sort(self.options.sort || { publishedAt: -1 });
      return cursor;
    };
  }
};
```

Four cool things happen here.

First, we extend the `apostrophe-pieces` module to create a module for managing blog posts, and we use `addFields` to extend the schema to include publication date and time fields as well as a `body` content area. *By default pieces don't have any content areas.*

Third, we add a constructor function in which we override the `beforeSave` method. `apostrophe-pieces` automatically calls `beforeSave` whenever a blog post is saved in the editor. By default `beforeSave` does nothing. Our version will update an easily sorted `publishedAt` field based on the publication date and time.

And fourth, we also override the `find` method and extend it. The `find` method returns a cursor to be used to fetch blog posts. We call the `sort` filter and set a default sort based on the publication date and time, in reverse chronological order, typical for blogs.

*Note the use of the "super pattern" to capture the original version of `self.find` and call it from the new one.*

**Finally, add this new module to the `modules` key in `app.js`.** We did all of our configuration in `index.js`, so our options object can be empty:

```javascript
'blog-posts': {}
```

*Apostrophe merges any configuration found in `modules` in app.js last, on top of whatever is found in `lib/modules/your-module-name/index.js`.*

Now we can create blog posts just by clicking on the Apostrophe logo, pulling down the "blog posts" menu and clicking "New Blog Post." We can also manage existing blog posts.

## Reading Blog Posts on the Site

There's nowhere to read the blog posts yet! We need a blog module. Let's subclass `apostrophe-pieces-pages` to create `blog`. `apostrophe-pieces-pages` lets us add a page type to our site that displays an "index" view of many pieces, with pagination, and allows us to click through to view each piece on its own page. This is a perfect jumping-off point for creating a blog.

We can get this going right away in `app.js` (add it to `modules`):

```javascript
'blog-posts-pages': {
  extend: 'apostrophe-pieces-pages'
}
```

Now we need to add `blog-posts` to the list of page types allowed on the site:

```javascript
'apostrophe-pages': {
  types: [
    {
      name: 'default',
      label: 'Default'
    },
    {
      name: 'home',
      label: 'Home'
    },
    {
      name: 'blog-posts-page',
      label: 'Blog'
    }
  ]
}
```

*If our module is named `blog-posts-pages`, `apostrophe-pieces-pages` will automatically trim off the "s" to arrive at a page type name for our blog.* That's how we knew what to add to the `types` array in order to let the user add a blog to the site.

### Body content for blog posts

If we test the site now, we'll find that we an add a page of type "Blog" to the site via the "Page Menu," and it displays a list of blog post titles. When we click one, we get a page with... just the title. Not very satisfying.

We have a body area with two widgets allowed in it, rich text and images (slideshows). And you can see that in the editor.

But, when you click through on the blog page to view a post you still don't see the body. So we need to override the `show.html` template in our `blog-posts-pages` module. First make a `views` folder for that module:

`mkdir -p lib/modules/blog-posts-pages/views`

*Apostrophe will automatically look here when templates for this module are rendered. If it doesn't find them it will look at the core Apostrophe module we're extending, `apostrophe-pieces-pages`.*

Now create `show.html` in that folder:

```html
{% extends data.outerLayout %}
{% block title %}{{ data.piece.title }}{% endblock %}

{% block main %}
<h2>{{ data.piece.title }}</h2>
{{ apos.area(data.piece, 'body', {
    widgets: {
      'apostrophe-rich-text': {
        toolbar: [ 'Bold', 'Italic', 'Link', 'Anchor', 'Unlink' ]
      },
      'apostrophe-images': { size: 'one-half' }
    }
  })
}}
{% endblock %}
```

### Pretty URLs for blog posts

By default, the URL of a blog post looks like:

`/blog/title-of-post-hyphenated`

This isn't terrible, but blogs can have many posts with similar titles and a sense of chronology is really helpful. Let's override two methods in the `blog-posts-pages` module to add the year, month and day to the URLs.

First install the `moment` npm module so we can format dates easily:

`npm install --save moment`

Now create `lib/modules/blog-posts-pages/index.js`:

```javascript
var moment = require('moment');

module.exports = {
  construct: function(self, options) {
    // Build a prettier URL for a blog post by incorporating the publication date. Slugs are
    // unique but this is nicer
    self.buildUrl = function(page, piece) {
      if (!page) {
        return false;
      }

      var url = page._url + '/' + moment(page.publishedAt).format('YYYY/MM/DD') + '/' + piece.slug;
      return url;
    };

    // Allow year/month/day in URLs to work. It's just window dressing; you can
    // also hit a blog post with just the slug, via the self.dispatch call made
    // in the apostrophe-pieces-pages module
    self.dispatch('/:year/:month/:day/:slug', self.showPage);
  }
};
```

In this constructor we're overriding the `buildUrl` method, called for each piece when a URL for it is needed, to incorporate the publication date like this:

`/blog/2016/01/01/happy-new-year`

And to actually display the blog post when that URL is fetched, we add a `self.dispatch` call to respond to URLs that look like that and invoke the existing `self.showPage` method:

```javascript
self.dispatch('/:year/:month/:day/:slug', self.showPage);
```

*`self.dispatch` is a feature of `apostrophe-custom-pages`, the parent class of `apostrophe-pieces-pages` and the grandparent of our module.* Whenever a URL begins with the slug of a blog (a page powered by our module),  `self.dispatch` lets us use Express-style route patterns to handle the rest of the URL. This powerful feature allows us to serve any kind of content by "adding on" to the URL of a page.

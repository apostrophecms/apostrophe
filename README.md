# Apostrophe

## This is an early alpha quality version of Apostrophe 2, for node.js developers. Most frontend design work has not happened yet. Blogs, events, etc. are not part of Apostrophe 2 yet. See [Apostrophe 1.5](http://apostrophenow.org) for the current stable and mature release of Apostrophe for PHP and Symfony.


Apostrophe is a content management system. This core module provides rich content editing as well as essential services to tie Apostrophe to your Express application. 

In addition to rich text, Apostrophe allows you to add rich media to documents. Apostrophe also includes simple facilities for storing your rich content areas in MongoDB and fetching them back again.

[You can try a live demo of the Apostrophe 2 sandbox app here.](http://demo2.apostrophenow.com/) (Note: the demo site resets at the top of the hour.) See also the [apostrophe-sandbox github project](http://github.com/punkave/apostrophe-sandbox).

Apostrophe introduces "widgets," separate editors for rich media items like photos, videos, pullquotes and code samples. Apostrophe's widgets handle these items much better than a rich text editor on its own.

Apostrophe also supports floating content properly, including wrapping text around images and video. Unlike other rich text editors, Apostrophe addresses the usability problems that go with floating content. Apostrophe users can see exactly where to add text above the floated element and where to add text after it so that it wraps around. When editing, Apostrophe displays positioning arrows before and after rich media elements that make it clear where they connect to the text and ensure it is always possible to add content above and below them. Apostrophe users can also easily select, cut, copy and paste rich content widgets exactly as if they were part of the text, without breaking them. You can even copy a video widget from one page of a site to another.

In summary, Apostrophe's rich media widgets are independently edited, but they are also part of the flow of a rich text document, with robust support for floating them if desired and displaying them at various well-chosen sizes rather than arbitrary sizes that may not suit your design. This is the major advantage of Apostrophe over other rich text editors.

Apostrophe also provides server-side node.js code providing a back end for all of the above: storing uploaded files, validating rich content, and storing rich content areas in MongoDB.

## Who are we?

Apostrophe is led by the team at [P'unk Avenue](http://punkave.com). Previously we created Apostrophe 1.5, a well-regarded content management system based on the Symfony framework for PHP. This Node-based version of Apostrophe is a complete rewrite, benefitting on everything we've learned since.

## Acknowledgements

Apostrophe wouldn't be nearly so awesome without [nunjucks](http://nunjucks.jlongster.com/), [Express](http://expressjs.com/) and [Rangy](http://code.google.com/p/rangy/). Please don't go anywhere near HTML's `contentEditable` attribute without Rangy. And a hip flask.

## Requirements

Apostrophe is intended to work in all major browsers from IE7 up, with best results in modern browsers such as recent versions of Firefox and Chrome. Of course the content you create with Apostrophe could work with any browser.

Apostrophe's server-side components are built in Node and require Express 3.0. Although in principle browser-side components of Apostrophe could talk to other languages, right now a close partnership with Node code on the server is driving the flow of development.

Apostrophe's server-side code uses uploadfs to store media files. uploadfs allows you to decide whether to keep them in a local filesystem, Amazon S3 or a custom backend. 

Apostrophe does not require any external CSS framework. Apostrophe's internal templates are processed with Nunjucks, which is awesome, but your Node application does not have to use Nunjucks.

You must have the following on your development and production servers:

node, of course
mongodb, on your local machine (or edit app.js to point somewhere else)
imagemagick, to resize uploaded images (specifically the `convert` command line tool)

Mac developers can install imagemagick via MacPorts. Your production server will need it too; it's probably a simple `apt-get install` or `yum` command away. Heroku includes imagemagick as standard equipment.

## Adding Editable Areas With Apostrophe: A Simple Example

### Configuring Apostrophe

You'll need to `npm install` the `node-apostrophe` npm package in your project, as well as `uploadfs`, `mongodb` and `express`. You might consider using [http://github.com/punkave/appy](appy), which eases the burden of setting up a typical Express app that supports all the usual stuff. But it's not a requirement.

Here's the `initApos` function of the sample application [http://github.com/punkave/apostrophe-sandbox](apostrophe-sandbox). Notice this function invokes a callback when it's done. `app.js` makes good use of the `async` module to carry out its initialization tasks elegantly. Here we also initialize other modules that snap into Apostrophe:

    function initApos(callback) {
      require('apostrophe-twitter')({ apos: apos, app: app });
      require('apostrophe-rss')({ apos: apos, app: app });

      async.series([initAposMain, initAposPages], callback);

      function initAposMain(callback) {
        console.log('initAposMain');
        return apos.init({
          db: db,
          app: app,
          uploadfs: uploadfs,
          permissions: aposPermissions,
          // Allows us to extend shared layouts
          partialPaths: [ __dirname + '/views/global' ]
        }, callback);
      }

      function initAposPages(callback) {
        console.log('initAposPages');
        pages = require('apostrophe-pages')({ apos: apos, app: app }, callback);
      }
    }

"Where does db come from?" It's a MongoDB native database connection. (Hint: convenient to set up with Appy, or just use mongodb-native yourself.) Apostrophe's getArea, putArea and getPage methods utilize these.

"What is `app`?" `app` is your Express 3.0 app object. See the Express documentation for how to create an application. Again, Appy helps here.

"What is `uploadfs`?" [http://github.com/punkave/uploadfs](uploadfs) is a module that conveniently stores uploaded files in either the local filesystem or S3, whichever you like. See `app.js` in the `apostrophe-sandbox` project for an example of configuration. You'll create an `uploadfs` instance, initialize it and then pass it in here.

"What is `aposPermissions`?" A function you define to decide who is allowed to edit content. If you skip this parameter, Apostrophe allows everyone to edit everything - not safe in production of course, but convenient in the early development stages.

To understand configuration in detail, you should really check out `app.js`. Please don't suffer without reading that simple and well-commented example.

### Making Sure Apostrophe Is In The Browser

Before we can add rich content areas to a webpage with Apostrophe, we need to make sure Apostrophe's CSS, JavaScript and widget editor templates are present in the page. Apostrophe adds convenience functions to your template language to accomplish that without a fuss. 

You will also need to make appropriate browser-side JavaScript calls to enable the "edit" buttons of areas and to enable video players in Apostrophe content.

Here's a simple `layout.html` Nunjucks template that includes everything Apostrophe needs:

    <!DOCTYPE html>
    <html lang="en">
      <head>
        {{ aposStylesheets() }}
        <link href="/css/my.css" rel="stylesheet" />
        {{ aposScripts() }}
      </head>
      <body>
        {% block body %}
        {% endblock %}
        {{ aposTemplates() }}
      </body>
      <script type="text/javascript">
        // Wait for domready!
        $(function() {
          apos.enableAreas();
          apos.enablePlayers();
        });
      </script>
    </html>

Note the `body` block, which can be overridden in any template that `extend`s this template. Jade has an identical feature.

"What if I hate the way you're loading CSS and JavaScript? What if I hate the version of jQuery you're loading?" Don't use the convenience functions. Instead examine Apostrophe's `scripts.html` and `stylesheets.html` templates and make sure you are loading the same functionality.

"Do I have to load all this stuff if I am certain the user has no editing privileges?" No. To make your pages lighter, if you know the user won't be editing, you can get by with just `content.css`, jQuery and `content.js`. We haven't spent much time testing this scenario yet. Pull requests to make it more convenient are welcome.

### Adding Editable Areas To Your Templates

The easiest way to add Apostrophe-powered editable rich content areas to your Node Express 3.0 project is to use Apostrophe's `aposArea` function, which is made available to your Express templates when you configure Apostrophe. Here's a simple example taken from the apostrophe-sandbox sample application:

    {{ aposArea({ slug: 'main', items: main, edit: true }) }}

This is from a Nunjucks template. If you're using Twig, you'll write:

!= aposArea({ slug: 'main', items: main, edit: true })

Sometimes Apostrophe's default set of controls include features that don't make sense in a sidebar or otherwise don't suit a design. In these cases you can limit the list.

This `aposArea` call turns on all of the controls. You can leave anything you like off the `controls` list:

    {{ aposArea({ slug: 'main', items: main, edit: true, controls: [ 'style', 'bold', 'italic', 'createLink', 'image', 'video', 'pullquote', 'code' ] }) }}

"What does `slug` mean?" Each area needs a unique "slug" to distinguish it from other editable content areas on your site. Many sites have slugs named `header`, `footer`, `sidebar` and the like.

"Where does `items` come from?" Good question. You are responsible for fetching the content as part of the Express route code that renders your template. You do this with Apostrophe's `getArea` and `getPage` methods. [Note: if you just want a tree of editable pages, use the apostrophe-pages module to do most of this work.](http://github.com/punkave/apostrophe-pages)

Naturally `getArea` is asynchronous:

    app.get('/', function(req, res) {
      apos.getArea(req, 'main', function(err, area) {
        return res.render('home', { content: area ? area.items : [] });
      });
    });

The `req` object is needed so that widget loaders can consider permissions and have an opportunity to perform caching when multiple queries occur during the lifetime of a single page request.

Note the code that checks whether `area` is actually set before attempting to access its content. If no area with that slug has ever been saved, the `area` callback parameter will be null.

Also note that there is an `err` parameter to the callback. Real-world applications should check for errors (and the `app.js` sample application does).

## Displaying Single Widgets ("Singletons")

Of course, sometimes you want to enforce a more specific design for an editable page. You might, for instance, want to require the user to pick a video for the upper right corner. You can do that with `aposSingleton`:

    {{ aposSingleton({ slug: slug + ':sidebarVideo', type: 'video', area: page.areas.sidebarVideo, edit: edit }) }}

Note that singletons are stored as areas. The only difference is that the interface only displays and edits the first item of the specified type found in the area. There is no rich text editor "wrapped around" the widget, so clicking "edit" for a video immediately displays the video dialog box.

Only widgets (images, videos and the like) may be specified as types for singletons. For a standalone rich-text editor that doesn't allow any widgets, just limit the set of controls to those that are not widgets:

    {{ aposArea({ slug: 'main', items: main, edit: true, controls: [ 'style', 'bold', 'italic', 'createLink' ] }) }}

## Detecting Empty Areas and Singletons

It's common to want to do something special if an area or singleton is empty, especially if the user does not have editing privileges. You can detect that:

    {% if (not edit) and aposSingletonIsEmpty({ area: page.areas.sidebarVideo, type: 'video' }) %}
      <p>Default placeholder video might go here</p>
    {% endif %}

`aposAreaIsEmpty` is also available. (Singletons are stored as areas but aposSingletonIsEmpty is correctly written to detect whether a widget of the proper type is present.)

## Grouping Areas Into "Pages"

"What if I'm building a site with lots of pages? Each page might have two or three areas. Is there an efficient way to get them all at once?"

Sure! Apostrophe provides a `getPage` method for this purpose. 

If you pass the slug `/about` to `getPage`, and areas exist with the following slugs:

    /about:main
    /about:sidebar
    /about:footer

Then `getPage` will fetch all of them and deliver an object like this:

    { 
      slug: '/about', 
      areas: { 
        main: { 
          slug: '/about/:main', 
          content: 'main content'
        } 
        sidebar: { 
          slug: '/about/:sidebar', 
          content: 'sidebar content'
        } 
        footer: { 
          slug: '/about/:sidebar', 
          content: 'footer content'
        } 
      } 
    }

"Those page objects look useful. Can I store other stuff in those? Page titles and so forth?" Yes. You can write your own mongo code to set additional properties on the objects in the pages collection. Apostrophe won't mind.

Apostrophe's putArea and getArea methods are written to automatically spot slugs containing a ":" and update or fetch an area within the areas property of a page in the pages collection, rather than creating a freestanding area object in the areas collection.

The [apostrophe-pages module](http://github.com/punkave/apostrophe-pages) uses this method to deliver complete pages automatically for you. In most cases this is what you'll want to do. In rarer cases you'll write your own routes that need to deliver content. See the sandbox project and the `apostrophe-pages` module for examples.

## Enforcing Permissions

You can hide edit buttons by passing `edit: false` to the `aposArea` function, and you should if the user doesn't have that privilege. But that doesn't actually prevent clever users from making form submissions that update areas. By default, everyone can edit everything if they know the URL. 

Of course this is not what you want. Fortunately it is very easy to pass your own custom permissions callback to Apostrophe.

When calling init(), just set the `permissions` option to a function that looks like this:

    function permissions(req, action, fileOrSlug, callback) { ... }

Once you've decided whether `req.user` should be allowed to carry out `action`, invoke `callback` with `null` to let the user complete the action, or with an error to forbid the action.

Currently the possible actions are `edit-area`, `edit-media`, `edit-page` and `view-page` (the latter two are added by the `apostrophe-pages` module). `edit-area` calls will include the slug of the area as the third parameter. `edit-media` calls for existing files may include a `file` object retrieved from Apostrophe's database, with an "owner" property set to the _id, id or username property of `req.user` at the time the file was last edited. `edit-media` calls with no existing file parameter also occur, for new file uploads.

A common case is to restrict editing to a single user but let view actions sail through:

    function permissions(req, action, object, callback) {
      if (req.user && (!action.match(/^view-/)) && (req.user.username === 'admin')) {
        // OK
        return callback(null);
      } else {
        return callback('Forbidden');
      }
    }

You can see an example of this pattern in `app.js` in the sandbox project.

## Extending Apostrophe

You can extend apos with additional widgets, and the [apostrophe-twitter](http://github.com/punkave/apostrophe-twitter) and [apostrophe-rss](http://github.com/punkave/apostrophe-rss) modules provide working examples. New widget types can even have custom loaders that bring in additional data on the server side as needed. It's neat stuff. 

The [apostrophe-pages](http://github.com/punkave/apostrophe-pages) module extends Apostrophe with full blown support for trees of editable web pages (like having a static site, except of course that your users can edit it gorgeously and intuitively).

## Minifying CSS and JS in Production

Apostrophe has built-in support for minifying its CSS and JS. This is done via the `uglify-js` and `clean-css` modules, which are pure JS and have good performance given the complexity of what they do.

By default, minification does not occur. This allows developers to click refresh and immediately see their changes, and also avoids the hassles of debugging minified code.

To turn on minification, just pass the `minify: true` option to Apostrophe. The `aposScripts` and `aposStylesheets` locals will then load a single minified file of each type.

Pass that option only in staging and production environments. We recommend resisting the urge not to minify on a staging server, because you need a truly faithful production-like environment to avoid surprises in production. You should minify on staging if you minify in production.

Apostrophe automatically minifies CSS and JS on the first request received (in each process), then reuses the result. There is no need to "clear the cache" or rebuild assets with grunt. Your production deployment process should always involve restarting Apostrophe, which will be the case if you use Stagecoach as seen in our sandbox project.

## Roadmap

Apostrophe is a work in progress. Certainly the following things need to improve:

* The built-in oembed proxy should cache thumbnails and markup.
* The built-in oembed proxy should have a whitelist of sites whose oembed codes are not XSS attack vectors.
* It should be possible to fetch summaries of areas conveniently and quickly. The new way of storing items as a structured array in MongoDB makes this possible, but a simple API for it should be exposed.
* It should be possible to fetch just certain rich media from areas conveniently and quickly (technically possible now, see above).

See github issues for more.

## Conclusion and Contact Information

That's it! You should have everything you need to enable rich content editing on your sites. If not, open an issue on github and we'll talk. See also the above roadmap.

Tom Boutell

[tom@punkave.com](mailto:tom@punkave.com)

[P'unk Avenue](http://punkave.com)

[http://github.com/punkave/apostrophe](http://github.com/punkave/apostrophe)

[@boutell](http://twitter.com/boutell)

[justjs.com](http://justjs.com)



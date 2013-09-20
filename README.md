# Apostrophe

### [See apostrophe-sandbox for a quick start guide and a ready-to-use starter project.](http://github.com/punkave/apostrophe-sandbox)

## About Apostrophe

Apostrophe is a content management system. This core module provides rich content editing as well as essential services to tie Apostrophe to your Express application. 

In addition to rich text, Apostrophe allows you to add rich media to documents. Apostrophe also includes simple facilities for storing your rich content areas in MongoDB and fetching them back again.

[You can try a live demo of the Apostrophe 2 sandbox app here.](http://demo2.apostrophenow.com/) (Note: the demo site resets at the top of the hour.) See also the [apostrophe-sandbox github project](http://github.com/punkave/apostrophe-sandbox).

*The sandbox provides a much simpler getting-started guide.* We recommend you start reading there. The rest of this document is mostly concerned with features of the apostrophe module itself and not the system as a whole.

Apostrophe introduces "widgets," separate editors for rich media items like photos, videos, pullquotes and code samples. Apostrophe's widgets handle these items much better than a rich text editor on its own.

Apostrophe also supports floating content properly, including wrapping text around images and video. Unlike other rich text editors, Apostrophe addresses the usability problems that go with floating content. Apostrophe users can see exactly where to add text above the floated element and where to add text after it so that it wraps around. When editing, Apostrophe displays positioning arrows before and after rich media elements that make it clear where they connect to the text and ensure it is always possible to add content above and below them. Apostrophe users can also easily select, cut, copy and paste rich content widgets exactly as if they were part of the text, without breaking them. You can even copy a video widget from one page of a site to another.

In summary, Apostrophe's rich media widgets are independently edited, but they are also part of the flow of a rich text document, with robust support for floating them if desired and displaying them at various well-chosen sizes rather than arbitrary sizes that may not suit your design. This is the major advantage of Apostrophe over other rich text editors.

Apostrophe also provides server-side node.js code providing a back end for all of the above: storing uploaded files, validating rich content, and storing rich content areas in MongoDB.

## Who are we?

Apostrophe is led by the team at [P'unk Avenue](http://punkave.com). Previously we created Apostrophe 1.5, a well-regarded content management system based on the Symfony framework for PHP. This Node-based version of Apostrophe is a complete rewrite, benefitting on everything we've learned since.

## Acknowledgements

Apostrophe wouldn't be nearly so awesome without [nunjucks](http://nunjucks.jlongster.com/), [Express](http://expressjs.com/) and [Rangy](http://code.google.com/p/rangy/). Please don't go anywhere near HTML's `contentEditable` attribute without Rangy. And a hip flask.

## Stability

Apostrophe 2 is in production on some client sites. Overall code stability is beta at this point.

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

"Where does db come from?" It's a MongoDB native database connection. (Hint: convenient to set up with Appy, or just use mongodb-native yourself.) Apostrophe's `getArea`, `putArea`, `getPage`, `putPage` and `get` methods utilize these.

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

The easiest way to add Apostrophe-powered editable rich content areas to your Node Express 3.0 project is to use Apostrophe's `aposArea` function, which is made available to your Express templates when you configure Apostrophe. Here's a simple example. Here we are using the `global` page, a convenient virtual "page" for storing areas that are used throughout the site, like a shared footer:

    {{ aposArea(global, 'content1', {
      edit: edit
    }) }}

This is from a Nunjucks template. The Nunjucks template language, which is compatible with the popular Jinja and Twig languages, is used throughout Apostrophe.

Sometimes Apostrophe's default set of controls include features that don't make sense in a sidebar or otherwise don't suit a design. In these cases you can limit the list.

This `aposArea` call turns on all of the controls. You can leave anything you like off the `controls` list:

    {{ aposArea(global, 'footer', {
      controls: [ 'style', 'bold', 'italic', 'createLink', 'image', 'video', 'pullquote', 'code' ]
    }) }}

You can also change the "styles" menu. However keep in mind that each "style" must be a legitimate HTML block element name and that not all browsers may support every block element in the rich text editor:

    {{ aposArea(global, 'footer', {
      controls: [ 'style', 'bold', 'italic', 'createLink', 'image', 'video', 'pullquote', 'code' ],
      styles: [ { value: 'div', label: 'Normal' }, { value: 'h3', label: 'Heading' }]
    }) }}

*Please note: at this time you should always list `div` as the first style.* We intend to remove this requirement in the future.

## Displaying Single Widgets ("Singletons")

Of course, sometimes you want to enforce a more specific design for an editable page. You might, for instance, want to require the user to pick a video for the upper right corner. You can do that with `aposSingleton`:

    {{ aposSingleton(global, 'my-video', { type: 'video' }) }}

Note that singletons are stored as areas. The only difference is that the interface only displays and edits the first item of the specified type found in the area. There is no rich text editor "wrapped around" the widget, so clicking "edit" for a video immediately displays the video dialog box.

Only widgets (images, videos and the like) may be specified as types for singletons. For a standalone rich-text editor that doesn't allow any widgets, just limit the set of controls to those that are not widgets:

    {{ aposArea(page, 'main', { controls: [ 'style', 'bold', 'italic', 'createLink' ] }) }}

## Detecting Empty Areas and Singletons

It's common to want to do something special if an area or singleton is empty, especially if the user does not have editing privileges. You can detect that:

    {% if (not edit) and aposSingletonIsEmpty({ area: page.areas.sidebarVideo, type: 'video' }) %}
      <p>Default placeholder video might go here</p>
    {% endif %}

`aposAreaIsEmpty` is also available. (Singletons are stored as areas but aposSingletonIsEmpty is correctly written to detect whether a widget of the proper type is present.)

## More About Grouping Areas Into "Pages"

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

"Those page objects look useful. Can I store other stuff in those? Page titles and so forth?" Yes. You can write your own mongo code to set additional properties on the objects in the pages collection. Apostrophe won't mind. And you can pass those properties when calling `putPage`. Just make sure you retrieve the entire page object with `getPage` or a suitable MongoDB query before saving it with `putPage` so you don't lose data.

Apostrophe's putArea and getArea methods are written to automatically spot slugs containing a ":" and update or fetch an area within the areas property of a page in the pages collection, rather than creating a freestanding area object in the areas collection.

The [apostrophe-pages module](http://github.com/punkave/apostrophe-pages) uses this method to deliver complete pages automatically for you. In most cases this is what you'll want to do. In rarer cases you'll write your own routes that need to deliver content. See the sandbox project and the `apostrophe-pages` module for examples.

## Enforcing Permissions

TODO: expand this section. Permissions on pages are enforced via lists of groups and people who have been given editing or viewing privileges, and admins can always edit everything. The permissions method usually should not be overridden because it would be incompatible with the fast database queries that locate pages the user is permitted to see or edit based on permissions.

You can hide edit buttons by passing `edit: false` to the `aposArea` function, and you should if the user doesn't have that privilege. But that doesn't actually prevent clever users from making form submissions that update areas. Fortunately Apostrophe's apos.permissions function is used to verify that the current user (based on req.user, if present) may carry out the requested action.

## Extending Apostrophe

You can extend apos with additional widgets, and the [apostrophe-twitter](http://github.com/punkave/apostrophe-twitter) and [apostrophe-rss](http://github.com/punkave/apostrophe-rss) modules provide working examples. New widget types can even have custom loaders that bring in additional data on the server side as needed. It's neat stuff.

The [apostrophe-pages](http://github.com/punkave/apostrophe-pages) module extends Apostrophe with full blown support for trees of editable web pages (like having a static site, except of course that your users can edit it gorgeously and intuitively).

The [apostrophe-snippets](http://github.com/punkave/apostrophe-snippets) module provides a way to maintain a library of reusable content and insert it anywhere on the site. This widget is also designed as a basis for creating modules like [apostrophe-blog](http://github.com/punkave/apostrophe-blog), [apostrophe-events](http://github.com/punkave/apostrophe-events) and [apostrophe-map](http://github.com/punkave/apostrophe-map) with a minimum of code duplication.

## Minifying CSS and JS in Production

Apostrophe has built-in support for minifying its CSS and JS. This is done via the `uglify-js` and `clean-css` modules, which are pure JS and have good performance given the complexity of what they do.

By default, minification does not occur. This allows developers to click refresh and immediately see their changes, and also avoids the hassles of debugging minified code.

To turn on minification, just pass the `minify: true` option to Apostrophe. The `aposScripts` and `aposStylesheets` locals will then load a single minified file of each type.

Pass that option only in staging and production environments. We recommend resisting the urge not to minify on a staging server, because you need a truly faithful production-like environment to avoid surprises in production. You should minify on staging if you minify in production.

Apostrophe automatically minifies CSS and JS on the first request received (in each process), then reuses the result. There is no need to "clear the cache" or rebuild assets with grunt. Your production deployment process should always involve restarting Apostrophe, which will be the case if you use Stagecoach as seen in our sandbox project.

## Passing Data and Calling Functions in the Browser From Server-Side Code

One of the great challenges of full-stack development is to pass data and call functions in browser-side javascript from server-side code without making a mess. Apostrophe can help here. Apostrophe has features that help you create a single block of clean JavaScript code and data assignment statements without escaping problems or a zillion separate `script` elements.

Apostrophe adds `req.pushCall` and `req.pushData` to the Express request object. You call `req.pushCall` like so:

    req.pushCall('something.func(?)', { any: { json: [5, 7] } });

You can do this as many times as you need to.

You can then call:

    apos.getCalls(res)

To obtain a block of JavaScript code ready to be popped into a `script` tag at the end of the `body` element. It's easy to pass that to your templates. If you are using the `apostrophe-pages` module, you don't even have to do that, because it is already passed as the `calls` property.

Every `?` in the pattern (the first argument) is replaced by a correctly JSON-encoded representation of each additional argument. You can use as many `?`s as you need.

JSON-encoding is a great way to avoid escaping bugs, but sometimes you do want one of your parameters to be inserted literally, for instance to pass a constructor function name dynamically. To do that, use `@` rather than `?`:

    req.pushCall('@(?)', 'SomeFunction', 'SomeData')

Note that `req.pushCall` pushes a call to be invoked just in the current HTTP request's response. To make calls that will be included in the `calls` property for *every* request, make a call like this:

    apos.pushGlobalCall('myblog.setup(?)', options)

Apostrophe's modules use this approach heavily for browser-side initialization.

You can use both `?` (escaped via JSON) and `@` (inserted literally) as placeholders here too.

Note: If you are not using the `apostrophe-pages` module, you'll need to call `apos.getCalls(req)` and `apos.getGlobalCalls()` to get two blocks of JavaScript source code ready to insert at the end of the body inside a `script` element. If you are using `apostrophe-pages` this is done for you, so your layout can just output both sets of calls (already concatenated together) via the `calls` property.

Apostrophe's `apostrophe-pages` module automatically makes these calls available as a single block of code ready to insert into a script tag at the end of the body.

### What About Data?

Well, we've already given you a way to pass data, since you can pass any arguments you like to any browser-side JavaScript code via the `pushCall` mechanism and JSON-escape the arguments automatically. However, there is an alternative way to pass data.

By calling `req.pushData({ ... })` and/or `apos.pushGlobalData({ ... })`, you can pass objects to the browser which will be merged into the browser-side JavaScript object `apos.data`. The merge operation is carried out recursively via `jQuery.extend`. That means that you can set some sub-properties on one call and set additional sub-properties on another.

Apostrophe's modules use this mechanism to push options for constructors like `AposBlogPosts` to scoop up later.

If you are not using the `apostrophe-pages` module to render the results, you'll need to call `apos.getData(req)` and `apos.getGlobalData()` to get the JavaScript blocks you'll want to invoke at the end of the body. You should do so *before* doing the same for `getCalls` and `getGlobalCalls`. If you are using `apostrophe-pages`, you can just take advantage of the `data` property already supplied to your page template.

`req.pushData` and `req.pushGlobalData` are not as flexible as `req.pushCall` and `req.pushGlobalCall`. In many cases you'll want to use the latter.

Keep in mind that all data passed via any of these mechanisms must be JSON-friendly. You cannot pass server-side function objects to browser-side code. That's just life in JavaScriptLand.

## Apostrophe Command-Line Tasks

We often need to carry out command line tasks, such as database migrations, with access to the same database and capabilities that regular Apostrophe code has access to. Apostrophe makes it really easy to register command line tasks as part of your application.

If the command line is:

    node app.js

The app will start listening for connections as normal, while if it is:

    node app.js apostrophe:migrate

The app will execute that task.

To see the available tasks, just type:

    node app.js apostrophe:help

This will list all of the registered tasks.

### Registering Your Own Tasks

You'll find that `app.js` invokes this code just before listening on the port:

    // Command line tasks
    if (apos.startTask()) {
      // Chill and let the task run until it's done,
      // don't try to listen or exit
      return;
    }
    appy.listen();

All you have to do is extend this by passing an object to `apos.startTask`. Each property of that object is a "task group" with one or more tasks. Each "task group" is an object with one or more task functions. Task functions receive three arguments: the `apos` object, an `argv` object with any command line options, and a callback to be invoked when the task is done.

Confused? Here's how to implement a single task called `project:init`:

    // Earlier in app.js

    var myTasks = {
      project: {
        init: function(apos, argv, callback) {
          // Do time consuming, asynchronous things!
          // When we're finished:
          return callback(null);
        }
      }
    };

    // In the listen function at the end of app.js

    if (apos.startTask(myTasks)) {
      return;
    }
    appy.listen();

This structure allows for projects with many tasks.

### "What if an error happens?"

Pass something other than null when invoking the callback.

### "What can I do with the argv object?"

The `argv` object comes from the optimist module. You can pick up command line arguments with it in a super-easy, super-friendly way. [See the optimist module for more information.](https://github.com/substack/node-optimist)

### "How do I call methods that need a req object?"

Good question. Lots of Apostrophe methods expect a `req` object, because permissions are tied to the identity of the user, and certain types of caching are tied to the lifetime of a request.

If your task needs to call a function like `snippets.get` which requires a `req` object, call this function to get a `req` object that always has unlimited permissions:

    apos.getTaskReq()

### "How do I hook into existing tasks?"

The `apos` object is an EventEmitter. In English, that means you can write:

    apos.on('task:apostrophe:migrate:before', function() {
      apos.taskBusy();
      // Do a variety of things asynchronously
      apos.taskDone();
    }

Or:

    apos.on('task:apostrophe:migrate:after', function() {
      apos.taskBusy();
      // Do a variety of things asynchronously
      apos.taskDone();
    }

### "What do apos.taskBusy and apos.taskDone do?"

Apostrophe needs to know when your task is finished. But you're likely to call asynchronous functions (functions with callbacks), so Apostrophe can't just assume that the task is finished when the function returns.

`apos.taskBusy()` solves this problem. If your task needs to do lots of asynchronous stuff, call `apos.taskBusy()`. The process will not exit until you call `apos.taskDone()`.

### "What if something goes wrong and the task should fail?"

Your event handler can call `apos.taskFailed()` in this situation.

## Roadmap

Apostrophe is a work in progress. See github issues for details on some of our plans as well as the Google Group.

## Conclusion and Contact Information

That's it! You should have everything you need to enable rich content editing on your sites. If not, open an issue on github and we'll talk. See also the above roadmap.

Tom Boutell

[tom@punkave.com](mailto:tom@punkave.com)

[P'unk Avenue](http://punkave.com)

[http://github.com/punkave/apostrophe](http://github.com/punkave/apostrophe)

[@boutell](http://twitter.com/boutell)

[justjs.com](http://justjs.com)



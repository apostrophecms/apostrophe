# Jot

Jot is a rich content and rich text editor. In addition to rich text, jot allows you to add rich media to documents. Jot also includes simple facilities for storing your rich content areas in MongoDB and fetching them back again.

[You can try a live demo of the Jot Wiki sample app here.](http://jotwiki.boutell.com/) (Note: the demo site resets at the top of the hour.)

Jot introduces "widgets," separate editors for rich media items like photos, videos, pullquotes and code samples. Jot's widgets handle these items much better than a rich text editor on its own.

Jot also supports floating content properly, including wrapping text around images and video. Unlike other rich text editors, Jot addresses the usability problems that go with floating content. Jot users can see exactly where to add text above the floated element and where to add text after it so that it wraps around. When editing, Jot displays positioning arrows before and after rich media elements that make it clear where they connect to the text and ensure it is always possible to add content above and below them. Jot users can also easily select, cut, copy and paste rich content widgets exactly as if they were part of the text, without breaking them. You can even copy a video widget from one page of a site to another.

In summary, Jot's rich media widgets are independently edited, but they are also part of the flow of a rich text document, with robust support for floating them if desired and displaying them at various well-chosen sizes rather than arbitrary sizes that may not suit your design. This is the major advantage of Jot over other rich text editors.

Jot also provides server-side node.js code providing a back end for all of the above: storing uploaded files, validating rich content, and storing rich content areas in MongoDB.

## Acknowledgements

Jot was inspired by the [Apostrophe](http://apostrophenow.org) content management system. The lead developer of Jot works on Apostrophe at [P'unk Avenue](http://punkave.com). Jot is under consideration as a component of Apostrophe 2, a Node-based next-generation version of Apostrophe.

Jot wouldn't be nearly so awesome without [nunjucks](http://nunjucks.jlongster.com/), [Express](http://expressjs.com/) and [Rangy](http://code.google.com/p/rangy/). Please don't go anywhere near HTML's `contentEditable` attribute without Rangy. And a hip flask.

## Requirements

Jot is intended to work in all major browsers from IE7 up, with best results in modern browsers such as recent versions of Firefox and Chrome. Of course the content you create with Jot could work with any browser.

Jot's server-side components are built in Node and require Express 3.0. Although in principle browser-side components of Jot could talk to other languages, right now a close partnership with Node code on the server is driving the flow of development.

Jot's server-side code uses uploadfs to store media files. uploadfs allows you to decide whether to keep them in a local filesystem, Amazon S3 or a custom backend. 

Jot does not require any external CSS framework. Jot's internal templates are processed with Nunjucks, which is awesome, but your Node application does not have to use Nunjucks.

You must have the following on your development and production servers:

node, of course
mongodb, on your local machine (or edit wiki.js to point somewhere else)
imagemagick, to resize uploaded images (specifically the `convert` command line tool)

Mac developers can install imagemagick via MacPorts. Your production server will need it too; it's probably a simple `apt-get install` or `yum` command away. Heroku includes imagemagick as standard equipment.

## Adding Editable Areas With Jot: A Simple Example

### Configuring Jot

You'll need to `npm install` the `node-jot` npm package in your project, as well as `uploadfs`, `mongodb` and `express`. You might consider using [http://github.com/boutell/appy](appy), which eases the burden of setting up a typical Express app that supports all the usual stuff. But it's not a requirement.

Here's the `initJot` function of the sample application [http://github.com/boutell/jotwiki](jotwiki). Notice this function invokes a callback when it's done. `wiki.js` makes good use of the `async` module to carry out its initialization tasks elegantly.

    function initJot(callback) {
      return jot.init({
        files: appy.files,
        areas: appy.areas,
        app: app,
        uploadfs: uploadfs,
        permissions: jotPermissions,
      }, callback);
    }

"What are `appy.files` and `appy.areas`?" MongoDB collections. You are responsible for connecting to MongoDB and creating these two collection objects, then providing them to Jot. (Hint: it's pretty convenient with Appy.) For best results, `areas` should have a unique index on the `slug` property.

"What is `app`?" `app` is your Express 3.0 app object. See the Express documentation for how to create an application. Again, Appy helps here.

"What is `uploadfs`?" [http://github.com/boutell/uploadfs](uploadfs) is a module that conveniently stores uploaded files in either the local filesystem or S3, whichever you like. See `wiki.js` for an example of configuration. You'll create an `uploadfs` instance, initialize it and then pass it in here.

"What is `jotPermissions`?" A function you define to decide who is allowed to edit content. If you skip this parameter, Jot allows everyone to edit everything - not safe in production of course, but convenient in the early development stages.

To understand configuration in detail, you should really check out `wiki.js`. Please don't suffer without reading that simple and well-commented example.

### Making Sure Jot Is In The Browser

Before we can add rich content areas to a webpage with Jot, we need to make sure Jot's CSS, JavaScript and widget editor templates are present in the page. Jot adds convenience functions to your template language to accomplish that without a fuss. 

You will also need to make appropriate browser-side JavaScript calls to enable the "edit" buttons of areas and to enable video players in Jot content.

Here's a simple `layout.html` Nunjucks template that includes everything Jot needs:

    <!DOCTYPE html>
    <html lang="en">
      <head>
        {{ jotStylesheets() }}
        <link href="/css/my.css" rel="stylesheet" />
        {{ jotScripts() }}
      </head>
      <body>
        {% block body %}
        {% endblock %}
        {{ jotTemplates() }}
      </body>
      <script type="text/javascript">
        // Wait for domready!
        $(function() {
          jot.enableAreas();
          jot.enablePlayers();
        });
      </script>
    </html>

Note the `body` block, which can be overridden in any template that `extend`s this template. Jade has an identical feature.

"What if I hate the way you're loading CSS and JavaScript? What if I hate the version of jQuery you're loading?" Don't use the convenience functions. Instead examine Jot's `scripts.html` and `stylesheets.html` templates and make sure you are loading the same functionality.

"Do I have to load all this stuff if I am certain the user has no editing privileges?" No. To make your pages lighter, if you know the user won't be editing, you can get by with just `content.css`, jQuery and `content.js`. We haven't spent much time testing this scenario yet. Pull requests to make it more convenient are welcome.

### Adding Editable Areas To Your Templates

The easiest way to add Jot-powered editable rich content areas to your Node Express 3.0 project is to use Jot's `jotArea` function, which is made available to your Express templates when you configure Jot. Here's a simple example taken from the jotwiki sample application:

    {{ jotArea({ slug: 'main', content: main, edit: true }) }}

This is from a Nunjucks template. If you're using Twig, you'll write:

!= jotArea({ slug: 'main', content: content, edit: true })

Sometimes Jot's default set of controls include features that don't make sense in a sidebar or otherwise don't suit a design. In these cases you can limit the list.

This `jotArea` call turns on all of the controls. You can leave anything you like off the `controls` list:

    {{ jotArea({ slug: 'main', content: main, edit: true, controls: [ 'style', 'bold', 'italic', 'createLink', 'image', 'video', 'pullquote', 'code' ] }) }}

"What does `slug` mean?" Each area needs a unique "slug" to distinguish it from other editable content areas on your site. Many sites have slugs named `header`, `footer`, `sidebar` and the like.

"Where does `content` come from?" Good question. You are responsible for fetching the content as part of the Express route code that renders your template. You do this with Jot's `getArea` method.

Naturally `getArea` is asynchronous:

    app.get('/', function(req, res) {
      jot.getArea('main', function(err, area) {
        return res.render('home', { content: area ? area.content : '' });
      });
    });

Note the code that checks whether `area` is actually set before attempting to access its content. If no area with that slug has ever been saved, the `area` callback parameter will be null.

Also note that there is an `err` parameter to the callback. Real-world applications should check for errors (and the `wiki.js` sample application does).

## Grouping Areas Into "Pages"

"What if I'm building a site with lots of pages? Each page might have two or three areas. Is there an efficient way to get them all at once?"

Sure! Jot provides a `getAreasForPage` method for this purpose. 

If you pass the slug `/about` to `getAreasForPage`, and areas exist with the following slugs:

    /about:main
    /about:sidebar
    /about:footer

Then `getAreasForPage` will fetch all of them and deliver an object like this:

    {
      main: {
        content: "rich content markup for main"
      },
      sidebar: {
        content: "rich content markup for sidebar"
      },
      footer: {
        content: "rich content markup for footer"
      },
    }

The [jotwiki sample application](http://github.com/boutell/jotwiki) uses this method to deliver complete Wiki pages:

    app.get('*', function(req, res) {
      var slug = req.params[0];
      jot.getAreasForPage(slug, function(e, info) {
        return res.render('page.html', { 
          slug: info.slug, 
          main: info.main ? info.main.content : '', 
          sidebar: info.sidebar ? info.sidebar.content : ''
        });
      });
    });

This is a simplified example. The actual code in `wiki.js` uses middleware to summon the page and footer information into the `req` object. There are two middleware functions, one for the page contents and one for a globally shared footer. It's a good strategy to consider. Perhaps we'll add some standard middleware functions like this soon:

    app.get('*', 
      function(req, res, next) {
        // Get content for this page
        req.slug = req.params[0];
        jot.getAreasForPage(req.slug, function(e, info) {
          if (e) {
            console.log(e);
            return fail(req, res);
          }
          req.page = info;
          return next();
        });
      },
      function(req, res, next) {
        // Get the shared footer
        jot.getArea('footer', function(e, info) {
          if (e) {
            console.log(e);
            return fail(req, res);
          }
          req.footer = info;
          return next();
        });
      },
      function (req, res) {
        return res.render('page.html', { 
          slug: req.slug, 
          main: req.page.main ? req.page.main.content : '', 
          sidebar: req.page.sidebar ? req.page.sidebar.content : '',
          user: req.user,
          edit: req.user && req.user.username === 'admin',
          footer: req.footer ? req.footer.content : ''
        });
      }
    );

Now `page.jade` can call `jotArea` to render the areas:

    {{ jotArea({ slug: slug + ':main', content: main, edit: true }) }}
    {{ jotArea({ slug: slug + ':sidebar', content: sidebar, edit: true }) }}

## Enforcing Permissions

You can hide edit buttons by passing `edit: false` to the `jotArea` function, and you should if the user doesn't have that privilege. But that doesn't actually prevent clever users from making form submissions that update areas. By default, everyone can edit everything if they know the URL. 

Of course this is not what you want. Fortunately it is very easy to pass your own custom permissions callback to Jot.

When calling init(), just set the `permissions` option to a function that looks like this:

    function permissions(req, action, fileOrSlug, callback) { ... }

Once you've decided whether `req.user` should be allowed to carry out `action`, invoke `callback` with `null` to let the user complete the action, or with an error to forbid the action.

Currently the possible actions are `edit-area` and `edit-media`. `edit-area` calls will include the slug of the area as the third parameter. `edit-media` calls for existing files may include a `file` object retrieved from Jot's database, with an "owner" property set to the _id, id or username property of `req.user` at the time the file was last edited. `edit-media` calls with no existing file parameter also occur, for new file uploads.

A common case is to restrict editing to a single user:

    function permissions(req, action, fileOrSlug, callback) {
      if (req.user && (req.user.username === 'admin')) {
        // OK
        return callback(null);
      } else {
        return callback('Forbidden');
      }
    }

You can see an example of this pattern in `wiki.js`.

## Roadmap

Jot is a work in progress. Certainly the following things need to improve:

* Developers should be able to leverage everything else in Jot without actually storing areas via the provided API. In particular, if I'm creating a blog post editor, I want an area to be part of it, but I don't want to store it separately or be forced to have a separate "save" button for it.
* Developers should be able to inject their own storage layer that satisfies an API. I think. Maybe. (Requiring MongoDB has its benefits.)
* The built-in oembed proxy should cache thumbnails and markup.
* The built-in oembed proxy should have a whitelist of sites whose oembed codes are not XSS attack vectors.
* Server-side content validation should be much smarter.
* It should be possible to fetch summaries of areas conveniently and quickly.
* It should be possible to fetch just certain rich media from areas conveniently and quickly.
* "Dynamic" widgets that require server-side interaction before the page is sent should be supported.
* There should be a server-side render method, in place of the existing client-side JavaScript to turn video placeholders into videos.
* Server-side renders should be cached, for a minimum lifetime equal to that of the widget with the shortest cache lifetime.
* A separate module that complements Jot by managing "pages" in a traditional page tree should be developed.

## Conclusion and Contact Information

That's it! You should have everything you need to enable rich content editing on your sites. If not, open an issue on github and we'll talk. See also the above roadmap.

Tom Boutell

[tom@punkave.com](mailto:tom@punkave.com)

[P'unk Avenue](http://punkave.com)

[http://github.com/boutell/jot](http://github.com/boutell/jot)

[@boutell](http://twitter.com/boutell)

[justjs.com](http://justjs.com)



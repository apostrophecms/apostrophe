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

```javascript
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

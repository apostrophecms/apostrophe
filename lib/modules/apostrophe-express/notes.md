Now that I've tried to implement the new middleware pattern for our modules and seen what it
looks like, I want to revise it just a little. I've stopped revising our module pattern for
the most part, because I'm well into implementation, but I haven't implemented middleware yet.

I had proposed separate `middleware` and `useMiddleware` sections. Separating them feels like
unnecessary complication. I think it can be much simpler, and feel more like `apiRoutes` or
`methods`.

This is what I'd like to go with:

```javascript
middleware(self, options) {
  return {
    optional: {
      // middleware methods in this section are not configured by default
      // for any routes at all, see below for example of use
      requireAdmin(req, res, next) {
        if (!self.apos.permissions.can(req, 'admin')) {
          return res.status(403).send('forbidden');
        }
        return next();
      }
    },
    // Middleware methods in this section are added for all routes, period
    always: {
      createData(req, res, next) {
        // This is how req.data gets born and is always present
        if (!req.data) {
          req.data = {};
        }
        return next();
      }
    }
  };
}
```

Using optional middleware in a route (this hasn't changed):

```javascript
apiRoutes(self, options) {
  return {
    post: {
      // Matches /api/v1/module-name/confirm
      confirm: [
        // Use optional middleware named above
        'requireAdmin',
        async (req) => {
          // do the actual route action here
        }
      ],
      // Routes without optional middleware still get to just be methods
      async gesture(req) { }
    }
  };
}
```

If I wanted to use named middleware provided by a different module, I could:

```javascript
apiRoutes(self, options) {
  return {
    post: {
      // Matches /api/v1/module-name/confirm
      confirm: [
        // Use optional middleware via our cross-module syntax
        'some-other-module:checkCoolnessFactor',
        async (req) => {
          // do the actual route action here
        }
      ]
    }
  };
}
```

Feel good?

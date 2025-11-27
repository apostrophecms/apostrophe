<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Apostrophe Passport Bridge</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a><img src="https://img.shields.io/badge/ASTRO%20READY-FF5D01.svg?style=for-the-badge&logo=Astro&labelColor=000000" alt="Astro Ready">
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/passport-bridge/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

**Enable enterprise-grade single sign-on (SSO) and social login** for your ApostropheCMS applications. Seamlessly integrate with Google Workspace, GitHub, GitLab, Auth0, and dozens of other identity providers to streamline user authentication and improve security.

## Why Passport Bridge?

- **🔐 Enterprise Security**: Leverage your existing identity infrastructure (Google Workspace, Azure AD, Okta)
- **⚡ Zero Password Fatigue**: Users log in once with credentials they already know and trust
- **🛡️ Reduced Security Risk**: Eliminate password storage and management on your site
- **👥 Team-Ready**: Perfect for organizations where users already have company accounts
- **🚀 Developer Friendly**: Works with 500+ [Passport.js strategies](https://www.passportjs.org/) with minimal configuration
- **💰 Cost Effective**: Reduce support overhead from password resets and account management

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```bash
npm install @apostrophecms/passport-bridge
# Example: Google OAuth (many other providers available)
npm install --save passport-google-oauth20
```

Most modules that have "passport" in the name and let you log in via a third-party website will work.

## Usage

Enable the `@apostrophecms/passport-bridge` module in the `app.js` file:

```javascript
import apostrophe from 'apostrophe';

apostrophe ({
  root: import.meta,
  // Configuring baseUrl is mandatory for this module. For local dev
  // testing you can set it to http://localhost:3000 while in production
  // it must be real and correct
  baseUrl: 'http://myproductionurl.com',
  shortName: 'my-project',
  modules: {
    '@apostrophecms/passport-bridge': {}
  }
});
```

Then configure the module in `modules/@apostrophecms/passport-bridge/index.js` in your project folder:

```javascript
export default {
  // In modules/@apostrophecms/passport-bridge/index.js
  options: {
    strategies: [
      {
        // You must npm install --save this module in your project first
        module: 'passport-google-oauth20',
        options: {
          // Options for passport-google-oauth20
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        },
        // Ignore users whose email address does not match this domain
        // according to the identity provider
        emailDomain: 'YOUR-DOMAIN-HERE.com',
        // Use the user's email address as their identity
        match: 'email',
        // Strategy-specific options that must be passed to the authenticate middleware.
        // See the documentation of the strategy module you are using
        authenticate: {
          // 'email' for the obvious, 'profile' for the displayName (for the create option)
          scope: [ 'email', 'profile' ]
        }
      }
    ]
  }
};
```

> ⚠️ Since we're not using the `create` option, users must actually exist in
> Apostrophe with the same username or email address, depending on the
> `match` option. If you want to automatically create users in Apostrophe,
> see [creating users on demand](#creating-users-on-demand) below.

### Working with passport strategies that expect different arguments to the `verify` callback

All passport strategies expect us to provide a `verify` callback. By default, `@apostrophecms/passport-bridge` passes its `findOrCreateUser` function as the `verify` callback, which works for many strategies including `passport-oauth2`, `passport-github2` and `passport-gitlab2`. For other strategies, you can pass an explicit `verify` option which will remap the strategy `verify` method to our `@apostrophecms/passport-bridge` `findOrCreateUser` method.

This method is responsible for retrieving the user in the ApostropheCMS database, or creating it. It is the `@apostrophecms/passport-bridge` equivalent of the strategy `verify` method.

For example, for `passport-oauth2`, the module's documentation shows the following:

```javascript
// https://www.passportjs.org/packages/passport-oauth2/
passport.use(new OAuth2Strategy({
    authorizationURL: 'https://www.example.com/oauth2/authorize',
    tokenURL: 'https://www.example.com/oauth2/token',
    clientID: EXAMPLE_CLIENT_ID,
    clientSecret: EXAMPLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/example/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ exampleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));
```

The second parameter of the strategy is the stratey `verify` method (`accessToken`, `refreshToken`, `profile`, `done`).

The default value for the `verify` option is equivalent to the following

```javascript
module.exports = {
  // In modules/@apostrophecms/passport-bridge/index.js
  options: {
    strategies: [
      {
        module: 'passport-oauth2|passport-github2|passport-gitlab2',
        options: {
          // ...
          // Default value for the verify option
          // verify: findOrCreateUser =>
          //   async (req, accessToken, refreshToken, profile, done) =>
          //     findOrCreateUser(req, accessToken, refreshToken, profile, done)
          }
        },
        // ...
      }
    ]
  }
};
```

If you're using `passport-auth0` or any other auth strategy for which the strategy `verify` method is different, please use the new `@apostrophecms/passport-bridge` `verify` option.

For instance, the `passport-auth0` module has a `verify` method that expects different arguments:

```javascript
// https://www.passportjs.org/packages/passport-auth0/
const Auth0Strategy = require('passport-auth0');
const strategy = new Auth0Strategy({
     // ...
     state: false
  },
  function(accessToken, refreshToken, extraParams, profile, done) {
    // ...
  }
);
```

To solve for this, you can do the following:

```javascript
module.exports = {
  // In modules/@apostrophecms/passport-bridge/index.js
  options: {
    strategies: [
      {
        module: 'passport-auth0',
        options: {
          // ...
          verify: findOrCreateUser =>
            async (req, accessToken, refreshToken, extraParams, profile, done) =>
              findOrCreateUser(req, accessToken, refreshToken, profile, done)
          }
        },
        // ...
      }
    ]
  }
};
```

If provided, the `verify` option must be a function.

That function accepts the normal verify callback from the passport bridge module, and returns an alternative function which accepts `req`, plus the arguments that are typical for `passport-auth0` or the strategy of your choice, and then invokes the normal verify callback with the arguments it expects, returning the result.

### Working with `oidc-client` and other passport strategies that don't follow typical patterns

Some passport strategies are more challenging than others. In particular, OIDC is best implemented with the [oidc-client](https://www.npmjs.com/package/oidc-client) module, but there are several challenges:

* Because of the way it is exported, the strategy cannot simply be `require`d for you by passport-bridge.
* The strategy does not accept a simple object of parameters for initialization.
* You will likely want to use the built-in discovery feature.
* The `verify` function has a different pattern.
* OIDC's standard "claims" are named differently from the profile properties commonly seen with oauth2-based strategies.

To solve for all of these, use the `factory` option. Here is a complete solution for `oidc-client`.

First, make sure you have the prerequisites:

* `npm install openid-client`
* `npm install @apostrophecms/passport-bridge`
* Add `@apostrophecms/passport-bridge: {}` to your `modules` section in `app.js`
* Set the `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` environment variables

*Note that `OIDC_ISSUER` should be the URL of an identity provider that supports OIDC discovery, which most
OIDC providers do.*

Now configure the passport bridge module:

```javascript
// in modules/@apostrophecms/passport-bridge/index.js of your project
// (do NOT modify the module in node_modules)

import * as client from 'openid-client';
import {
  Strategy
} from 'openid-client/passport'

export default {
  options: {
    // Optional
    create: {
      role: 'guest'
    },
    strategies: [
      {
        async factory(params, fn) {
          const issuer = new URL(process.env.OIDC_ISSUER);
          const config = await client.discovery(
            issuer,
            process.env.OIDC_CLIENT_ID,
            process.env.OIDC_CLIENT_SECRET
          );
          const {
            // injected into params by passport-bridge
            callbackURL
          } = params;
          const strategy = new Strategy({
            config,
            scope: 'openid email',
            callbackURL
          }, (tokens, callback) => {
            const claims = tokens.claims();

            const profile = {
              id: claims.sid,
              displayName: claims.name,
              firstName: claims.given_name,
              lastName: claims.family_name,
              email: claims.email,
              username: claims.preferred_username
            };
            return fn(null, tokens.access_token, tokens.refresh_token, profile, callback);
          });

          // The strategy sets it to the hostname, which varies. Override so we can predict the URLs
          strategy.name = 'oidc';
          return strategy;
        },
        // Also required when using a factory function
        name: 'oidc',
        // These would show up in "params" above, we chose to use environment
        // variables instead
        options: {},
        // Use the user's email address as their identity. You
        // could also specify 'id', or 'username' if the latter is unique
        match: 'email'
      }
    ]
  }
}
```

### Adding login links for a traditional ApostropheCMS project

The easiest way to enable login is to use the `loginLinks` async component in your template:

```markup
{% component "@apostrophecms/passport-bridge:loginLinks" %}
```

This component will output links that attempt to bring the user back to the same page after login, and to keep them in the same locale even if your site has separate hostnames configured for separate locales.

You can override this template's markup by copying `views/loginLinks.html` from this npm module to your project-level `modules/@apostrophecms/passport-bridge/views` folder.

You can also determine the login URLs by invoking the `@apostrophecms/passport-bridge:list-urls` task, however this method does not give you a way to preserve the current URL or redirect back to the current locale's hostname.

### Using login links with headless ApostropheCMS and an Astro Frontend

When using `@apostrophecms/passport-bridge` with an Astro frontend (via [`@apostrophecms/apostrophe-astro`](https://github.com/apostrophecms/apostrophe-astro)), the built-in `loginLinks` component won't work since Astro handles template rendering instead of Nunjucks.

**1. Configure Astro Proxy Routes**

First, configure your Astro frontend to proxy authentication routes to ApostropheCMS. In your `astro.config.mjs` within the `apostrophe` configuration:

```javascript
integrations: [
  apostrophe({
    aposHost: 'http://localhost:3000',
    proxyRoutes: [
      '/auth/[...slug]'
    ]
    // remainder of configuration
  })
]
```

This ensures all authentication-related routes (such as `/auth/google/login`, `/auth/github/login`, `/auth/gitlab/callback`, etc.) are properly forwarded to your ApostropheCMS backend.

**2. Configure Passport Bridge with Redirects**

Update your passport bridge configuration to handle successful and failed authentication redirects to your Astro frontend. The key addition is the `successRedirect` and `failureRedirect` properties in the authenticate section:

```javascript
// backend/modules/@apostrophecms/passport-bridge/index.js
export default {
  options: {
    strategies: [
      {
        // Example with Google OAuth - adapt for your chosen strategy
        module: 'passport-google-oauth20',
        options: {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.APOS_HOST || 'http://localhost:3000'}/auth/google/callback`
        },
        match: 'email',
        authenticate: {
          scope: ['email', 'profile'],
          // These redirects are crucial for Astro integration:
          successRedirect: process.env.APOS_BASE_URL || 'http://localhost:4321/',
          failureRedirect: `${process.env.APOS_BASE_URL || 'http://localhost:4321'}/login?error=oauth_failed`
        }
      }
    ]
  }
};
```

**3. Add a login link to your frontend template**

In the backend portion of the project use the CLI task to list the configured authentication URLs.

```bash
node app @apostrophecms/passport-bridge:listUrls
```
This will provide the URL (or multiple URLs if you have multiple strategies defined) that you can add to your desired frontend component.

## Environment Variables

Make sure to set the following environment variables:

- `APOS_HOST`: Your ApostropheCMS backend URL (e.g., `http://localhost:3000`)
- `APOS_BASE_URL`: Your Astro frontend URL (e.g., `http://localhost:4321`)
- Strategy-specific variables like `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

## Handling Authentication State

After successful authentication, users will be redirected to your Astro frontend. You can check authentication state by making requests to your ApostropheCMS backend's session endpoints or by implementing additional API routes to expose user information.

## Error Handling

The `failureRedirect` configuration will send users to your specified error page (e.g., `/login?error=oauth_failed`) where you can display appropriate error messages based on URL parameters.

### Configuring your identity provider

#### What is my oauth callback URL?

Many strategies require an oauth callback URL. To discover those, run this command line task to print the URLs for login, and for the oauth callback URLs:

```
node app @apostrophecms/passport-bridge:listUrls
```

You'll see something like:

```
These are the login URLs you may wish to link users to:

/auth/gitlab/login

These are the callback URLs you may need to configure on sites:

http://localhost:3000/auth/gitlab/callback
```

⚠️ You can use a URL like `http://localhost:3000` for testing but in production you must use your production URL. Most identity providers will reject a URL beginning with `http:` or an IP address, except for `http://localhost:3000` which is often accepted for testing purposes only.

#### Where do I get my `clientID`, `clientSecret`, etc.?

You get these from the identity provider, usually by adding an "app" to your profile or developer console. In the case of Google you will need to [create an application in the Google API console and authorize it to perform oauth logins](https://developers.google.com/). See the documentation of the passport strategy module you're using.

### Creating users on demand

If you wish you can enable automatic creation of new accounts for any user who is valid according to your login strategy, for instance any user in your Google workspace.

```javascript
module.exports = {
  // In modules/@apostrophecms/passport-bridge/index.js
  options: {
    ...
    create: {
      // If you wish to treat all valid google users in your domain as
      // admins of the site. See also `guest`, `contributor`, `editor`
      //
      role: 'admin'
    }
  }
};
```

### Beefing up the "create" option: copying extra properties

The "create" option shown above will create a user with minimal information: first name, last name, full name, username, and email address (where available).

If you wish to import other fields from the profile object provided by the passport strategy, add an `import` function to your configuration for that strategy. The `import` function receives `(profile, user)` and may copy properties from `profile` to `user` as it sees fit. It may not be an async function.

### Multiple strategies

You may enable more than one strategy at the same time. Just configure them consecutively in the `strategies` array. This means you can have login via Twitter, Google, etc. on the same site.

> ⚠️ Take care when choosing what identity providers to trust. When using single sign-on, your site's security is only as good as that of the identity provider you are trusting. If multiple strategies are enabled with `email` as the matching method, and a malicious user succeeds in creating an account with that email address that matches any of the strategies, then that is sufficient for them to log in. Most major public providers, like Facebook, Twitter or Google, do require the user to prove they control an email address before associating it with an account.

## Accessing the user's `accessToken` and `refreshToken` to make API calls

When we authenticate the user via an identity provider like `github` that has APIs
of its own, it is often desirable to call additional APIs of that provider.

Setting the `retainAccessToken` option to `true` retains the `accessToken` and `refreshToken` in Apostrophe's "safe," which is a special storage place for sensitive data associated with a user.

You can then access that data like this:

```javascript
const tokens = await self.apos.user.getTokens(req.user, 'github');
if (tokens) {
  // Use tokens.accessToken and, sometimes, tokens.refreshToken
} else {
  // Tell the user to connect with github again
}
```

A passport strategy name is always required. Unfortunately, this is not the same thing as
the npm module name. If you do not know the strategy name, check
the `strategy.js` file in the source code of the Passport strategy module you are
using, such as `passport-github`.

There is no guarantee that a particular strategy supports tokens, or requires both
`accessToken` and `refreshToken`.

Access tokens can expire. If the access token expires and the strategy you are using
supports OAuth refresh tokens (not OIDC), you can ask Apostrophe to refresh it:

```javascript
// Passing in the existing refresh token is optional, but avoids an extra database call
const { accessToken, refreshToken } = await self.apos.user.refreshTokens(req.user, 'github', refreshToken);
```

If the refresh fails, an exception is thrown. In addition, if it fails with a
"401: Unauthorized" error, the tokens are removed, so that the next call
to `getTokens` will return null.

If you need to refresh the tokens yourself by other means, you can pass in the result:

```javascript
// We obtained these new tokens by means of our own
await self.apos.user.updateTokens(req.user, 'github', { accessToken, refreshToken });
```

Passing in the existing access token and refresh token is optional, and avoids
waiting for an extra database call.

> Determining whether an access token has expired will depend on the platform-specific APIs you
are calling, but most will return a `401` status code in this situation.

To simplify this flow, use `withAccessToken`. Here is an example
where the github Octokit API is used. The API request in the nested function is first made with
the existing access token. If an exception with a `status` property equal to `401`
is thrown, the token is refreshed and updated, and the nested function is invoked again
with the new token. If the refreshed access token also fails with a `401`, the error is
allowed to throw. All other errors are allowed to pass through.

```javascript
const { Octokit } = require("@octokit/rest");

const repos = await self.apos.user.withAccessToken(req.user, 'github', async (accessToken, unauthorized) => {
  const octokit = Octokit({ auth: accessToken });
  return req.octokit.rest.repos.listForAuthenticatedUser({
    affiliation: 'owner',
    // 100 is the max allowed per page
    per_page: 100
  });
});
// Do something cool with `repos`
```

Not all APIs that expect access tokens are created equal. If the API you are calling throws
an error in this situation that doesn't have `status: 401`, you can throw a suitable
object yourself (pseudocode):

```javascript
try {
  await someStrangeAPI(accessToken);
} catch (e) {
  // Just an example, your mileage will vary
  if (e.toString().includes('unauthorized')) {
    throw {
      status: 401
    };
  } else {
    // Some other error, let it fail
    throw e;
  }
}
```

## Issues with multiple services

### Conflicting usernames

If a user is already logged in, for instance via Apostrophe's standard login screen,
and then passes through the Passport flow to log in via a second identity provider,
Passport will log the user out of the first account by default, and in most cases
will wind up creating a second account, or mistakenly reuse an account associated
with a different service.

This problem can be mitigated by setting `match` to `email` for each strategy, as long
as the user has the same email address in each case and the service in question
offers email addresses as an option.

### "Connecting" accounts without creating a second account

An individual may want to associate an ordinary Apostrophe account with a secondary service,
such as a github account, that has a different email address. Unfortunately, in this case,
simply following a link to the login URL for a second service this will log the user out of
the first account and log them into an entirely separate account based on the email address
from github when using `match: 'email'` as described above. If using `match: 'id'`, the
behavior is more consistent, but still undesirable: a separate account is always created.

This can be addressed via the following flow:

1. The user logs in normally to their Apostrophe account.

2. Await `requestConnection` to generate a confirmation link and email it
to the current user's email address. When this method resolves, the email has been
handed off for delivery, and it is appropriate to tell the user to expect it soon.

> Apostrophe must be
> [correctly configured for reliable email delivery](https://v3.docs.apostrophecms.org/guide/sending-email.html#sending-email-from-your-apostrophe-project).
> If you do not take appropriate steps to ensure this, the email probably will not get through.

```javascript
await self.apos.user.requestConnection(req, 'STRATEGY NAME HERE', {
  redirectTo: '/site/relative/url/here',
});
```

> The strategy name depends on the passport strategy in question. `passport-github` uses
> the strategy name `github`. You can find it in the source of the strategy module
> you are using and it is usually your first guess as well.

3. The user receives the email and follows the link provided.

4. The user is redirected to authorize access to their `github` account (in this example).

5. The user is redirected to the home page, or to the URL you optionally specify via
`redirectTo`. They are still logged into the original account. Their strategy-specific id
is captured in their `user` piece as `githubId` (in the case of the github strategy;
substitute the appropriate strategy name), and their tokens are available as described
earlier if `retainSessionToken: true` is set.

> Note that for security reasons, the link in the email is only valid for twenty-four hours.

### Overriding the email template

To override the email message that is sent, copy `views/connectEmail.html` from
the `@apostrophecms/passport-bridge` npm module to your project-level
`modules/@apostrophecms/passport-bridge/views` folder, and edit that template you see fit.

### Session properties

Note that when following this flow the user's original req.session properties are
preserved. Normally this is not possible, because Passport 0.6 or better always
regenerates the session on a new login.

### Logging in via the secondary strategy

In this example, a user who "connects" their account to github will be able to
"log in via github" in the future, if they so choose. Since we trust that github
maintains good security, and they proved control of the original account before
connecting with github, this is usually acceptable.

However, if you wish to block this for a particular strategy you can specify
the `login: false` option when configuring that strategy. If you take this
path, users will be able to "connect" an account using that strategy to their
original account, but will not be able to log in via that strategy alone. In this
situation the secondary strategy is present for API token access only.

### Disconnecting a strategy from an account

You can disconnect a strategy at any time:

```javascript
await self.apos.user.removeConnection(req, 'STRATEGY NAME HERE');
```

This will clear the related strategy-specific id, e.g. it will purge `githubId`
if the strategy name is `github`.

## Frequently asked questions

### Where do I `require` or `import` the passport strategy?

You *can* do that, if you use the `factory` option, as shown above. This is useful with modules that have an unusual initialization process, like `openid-client`.

But in many cases, you don't have to. Apostrophe can do it for you. Passing the module name in the appropriate entry in your `strategies` array is enough. The `options` sub-property and sometimes also the `authenticate` sub-property are useful if your chosen strategy  has options that must be passed to its `authenticate` middleware, as with Google and most others (you'll see this in the documentation of the strategy you are using).

### Can I change how users are mapped between the identity provider and my site?

If you don't like the default behavior, you can change it. The mapping is up to you. Usernames and emails are *almost* permanent, but people do change them and that can be problematic, especially if they are reused by someone else.

On the other hand, IDs are a pain to work with if you are creating users in advance and not using the `create` feature of the module.

You can set the `match` option for any strategy to one of the following choices:

#### `id`

Matches on the id of their profile as returned by the strategy module. This is most unique, however if you don't set `create`, then you'll need to find out the ids of users in advance and populate them in your database. You could do that by adding a string field to the `fields` configuration of the `@apostrophecms/user` module in your project.

To accommodate multiple strategies, If the strategy name is `google`, then the id needs to be in the `googleId` field of the user. If the strategy name is `gitlab`, the id needs to be in `gitlabId`, and so on. If you are using the `create` feature, these properties are automatically populated for you.

**The strategy name and the npm module name are not quite the same thing.** Look at the output of `node app @apostrophecms/passport-bridge:list-urls`. The word that follows `/auth` is the strategy name.

#### `email`

This will match on any email the authentication provider indicates they own, whether it is an array in the `.emails` property of their profile containing objects with `.value` properties (as with Google), an array of strings in `.emails`, or just an `email` string property. *To minimize confusion you can also set `match` to `emails` which has the same effect. Either way it will check all three cases.*

#### `username`

The default. Users are matched based on having the same username.

#### A function of your choice

If you provide a function rather than a string, it will receive the user's profile from the passport strategy, and must return a MongoDB criteria object matching the appropriate user. Do not worry about checking the `disabled` or `type` properties, Apostrophe will handle that.

### How can I reject users in a customized way?

You can set your own policy for rejecting users by passing an `accept` function for any strategy. This function takes the `profile` object provided by the passport strategy and must return `true` otherwise the user is not permitted to log in.

### How can I lock down my site by email address domain name?

You may wish to accept only users from one email domain, which is very handy if your company's email is hosted by Google (aka "G Suite", aka "Google Workspaces"). For that, also set the `emailDomain` option to the domain name you wish to allow. All others are rejected. This is very important if you are using the `create` option.

### How can I reject direct logins via Apostrophe's login form?

"This is great, but I want to disable the regular `/login` page." You can:

```javascript
// in app.js
modules: {
  '@apostrophecms/passport-bridge': {
    // As above; this is not where we disable local login...
  },
  '@apostrophecms/login': {
    // We disable it here, by configuring the built-in @apostrophecms/login module
    localLogin: false
  }
}
```

The built-in login page is powered by Passport's `local` strategy, which is added to Apostrophe by the standard `@apostrophecms/login` module. That's why we disable it there and not in `@apostrophecms/passport-bridge`'s options.

### How can I override the error page?

If login fails, for instance because you are matching on `email` but the `username` duplicates another account, or because a user is valid in Google but `emailDomain` does not match, the `error.html` template of the `apostrophe-passport` module is rendered. By default, it works, but it's pretty ugly! You'll want to customize it to your project's needs.

Like other templates in Apostrophe, you can override this template by copying it to `modules/@apostrophecms/passport-bridge/views/error.html` *in your project* (**never modify the npm module itself**). You can then extend your own layout template and so on, just as you have most likely already done for the 404 Not Found page.

### How can I redirect the standard `/login` page to one of my strategies?

Once you have disabled the regular login page, it's possible for you to decide what happens at that URL. Use the [@apostrophecms/redirect](https://npmjs.org/package/@apostrophecms/redirect) module to set it up through a nice UI, or add an Express route and a redirect in your own code.

### What if it doesn't work?

Feel free to open an issue but be sure to provide full specifics and a test project. Note that some strategies may not follow the standard practices this module is built upon. Those written by Jared Hanson, the author of Passport, or following his best practices should work well. You might want to test directly with the sample code provided with that strategy module first, to rule out problems with the module or with your configuration of it.

### How can I debug the system?

By default this module will log quite a bit of information in a development environment, using the `debug` ApostropheCMS log level. When `NODE_ENV` is production this logging is suppressed by default. See the [`@apostrophecms/log` module documentation](https://docs.apostrophecms.org/guide/logging.html) for information how to change this.

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/passport-bridge">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>
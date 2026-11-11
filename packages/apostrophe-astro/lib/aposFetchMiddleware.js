// Astro middleware that provides `Astro.locals.aposFetch`, a fetch scoped to
// the current request: it reaches Apostrophe for the current site (multisite
// selects the site by `host`) as the current user. Registered in both SSR and
// static mode; during a static build it is the unscoped `aposFetch`.
import { defineMiddleware } from 'astro:middleware';
import { createAposFetch } from '../helpers/server/fetch.js';

export const onRequest = defineMiddleware((context, next) => {
  context.locals.aposFetch = createAposFetch(context.request);
  return next();
});

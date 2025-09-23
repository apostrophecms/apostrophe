/**
 * Utilities for discovering and shaping ApostropheCMS routes for OpenAPI generation.
 * - Reads the Express route registry exposed by @apostrophecms/express
 * - Applies optional exclusions configured on the generator module
 * - Normalizes Express-style params (:id) to OpenAPI-style ({_id})
 * - Determines grouping metadata for tags/modules
 */
export class RouteDiscovery {
  /**
   * @param {any} apos - Apostrophe instance.
   */
  constructor(apos) {
    this.apos = apos;
    this.expressModule = apos.modules['@apostrophecms/express'];
    this.generatorModule = apos.modules['openapi-generator'];
  }

  /**
   * Discover all routes registered in Apostrophe's Express layer and
   * return normalized entries suitable for OpenAPI path generation.
   *
   * @returns {Promise<Array<{
   *   method: string,
   *   url: string,
   *   path: string,
   *   needsPrefixStrip: boolean,
   *   resourceInfo: { type: string, module: string, resource: string, tag: string }
   * }>>}
   * @throws {Error} If the route registry cannot be accessed.
   */
  async discoverRoutes() {
    if (!this.expressModule?.finalModuleMiddlewareAndRoutes) {
      throw new Error('Could not access ApostropheCMS route registry');
    }

    const rawRoutes = this.expressModule.finalModuleMiddlewareAndRoutes
      .filter(info => info.route)
      .map(info => ({
        method: info.method?.toUpperCase() || 'UNKNOWN',
        url: info.url,
        // Preserve any additional metadata that might exist
        middleware: info.before,
        ...info
      }));

    return this.processRoutes(rawRoutes);
  }

  /**
   * Apply exclusions, normalize params, compute grouping metadata, and
   * optionally strip the /api/v1 prefix for OpenAPI paths.
   *
   * @param {Array<{ method?: string, url: string }>} rawRoutes
   * @returns {Array<{
   *   method: string,
   *   url: string,
   *   path: string,
   *   needsPrefixStrip: boolean,
   *   resourceInfo: { type: string, module: string, resource: string, tag: string }
   * }>}
   */
  processRoutes(rawRoutes) {
    const excludedRoutes = this.generatorModule?.options?.openapiRoutes?.exclude || [];

    return rawRoutes
      .filter(route => {
        // Check if this route should be excluded
        const routePath = route.url.replace('/api/v1/', '');
        return !excludedRoutes.some(excluded => routePath.includes(excluded));
      })
      .map(route => {
        const processed = {
          ...route,
          // Convert Express params (:id) to OpenAPI params ({_id})
          path: this.convertParamsToOpenAPI(route.url),
          // Determine if this route needs the /api/v1 prefix stripped
          needsPrefixStrip: this.shouldStripPrefix(route.url),
          // Extract module/resource information for grouping
          resourceInfo: this.extractResourceInfo(route.url)
        };

        // Strip prefix if needed
        if (processed.needsPrefixStrip) {
          processed.path = processed.path.replace('/api/v1', '');
        }


        // normalize here so `/piece/` → `/piece`
        // this is for `restApiRoute` adding a slash at the end of `getAll` routes
        processed.path = this.normalizePath(processed.path);

        return processed;
      });
  }

  /**
   * Convert Express-style params to OpenAPI-style params.
   * Example: "/api/v1/article/:id" → "/api/v1/article/{_id}"
   *
   * @param {string} url
   * @returns {string}
   */
  convertParamsToOpenAPI(url) {
    // Convert Express :param syntax to OpenAPI {param} syntax
    // Keep _id as {_id} for ApostropheCMS convention
    return url.replace(/:([^/]+)/g, '{$1}');
  }

  /**
   * Whether the /api/v1 prefix should be stripped from the final OpenAPI path.
   * Usually true for API routes so the spec can define a server baseUrl once.
   *
   * @param {string} url
   * @returns {boolean}
   */
  shouldStripPrefix(url) {
    // Strip /api/v1 prefix for most routes, but not for custom routes that don't have it
    return url.startsWith('/api/v1');
  }

  /**
   * Extract metadata used to group/tag routes in the OpenAPI spec.
   * Handles core modules, pro modules, custom types, and non-API page routes.
   *
   * @param {string} url
   * @returns {{ type: string, module: string, resource: string, tag: string }}
   */
  extractResourceInfo(url) {
    // Extract module and resource information for OpenAPI organization

    // Handle core apostrophe modules: /api/v1/@apostrophecms/module-name/action
    const coreModuleMatch = url.match(/^\/api\/v1\/@apostrophecms\/([^\/]+)/);
    if (coreModuleMatch) {
      return {
        type: 'core',
        module: `@apostrophecms/${coreModuleMatch[1]}`,
        resource: coreModuleMatch[1],
        tag: this.formatTag(coreModuleMatch[1])
      };
    }

    // Handle pro modules: /api/v1/@apostrophecms-pro/module-name/action
    const proModuleMatch = url.match(/^\/api\/v1\/@apostrophecms-pro\/([^\/]+)/);
    if (proModuleMatch) {
      return {
        type: 'pro',
        module: `@apostrophecms-pro/${proModuleMatch[1]}`,
        resource: proModuleMatch[1],
        tag: this.formatTag(`${proModuleMatch[1]} (Pro)`)
      };
    }

    // Handle custom piece types: /api/v1/custom-type/action
    const customTypeMatch = url.match(/^\/api\/v1\/([^\/]+)/);
    if (customTypeMatch) {
      return {
        type: 'custom',
        module: customTypeMatch[1],
        resource: customTypeMatch[1],
        tag: this.formatTag(customTypeMatch[1])
      };
    }

    // Handle non-API routes (like /login)
    const nonApiMatch = url.match(/^\/([^\/]+)/);
    if (nonApiMatch) {
      return {
        type: 'page',
        module: nonApiMatch[1],
        resource: nonApiMatch[1],
        tag: this.formatTag(`${nonApiMatch[1]} (Pages)`)
      };
    }

    // Fallback
    return {
      type: 'unknown',
      module: 'unknown',
      resource: 'unknown',
      tag: 'Unknown'
    };
  }

  /**
   * Convert a kebab/camel/underscore name into Title Case for OpenAPI tags.
   *
   * @param {string} name
   * @returns {string}
   */
  formatTag(name) {
    // Convert kebab-case or camelCase to Title Case for OpenAPI tags
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Group processed routes by their resource key, carrying tag/module/type
   * metadata for clean OpenAPI tag sections.
   *
   * @param {Array<{
   *   resourceInfo: { resource: string, tag: string, type: string, module: string }
   * }>} processedRoutes
   * @returns {Map<string, {
   *   tag: string,
   *   type: string,
   *   module: string,
   *   routes: Array<any>
   * }>}
   */
  groupRoutesByResource(processedRoutes) {
    const grouped = new Map();

    processedRoutes.forEach(route => {
      const key = route.resourceInfo.resource;
      if (!grouped.has(key)) {
        grouped.set(key, {
          tag: route.resourceInfo.tag,
          type: route.resourceInfo.type,
          module: route.resourceInfo.module,
          routes: []
        });
      }
      grouped.get(key).routes.push(route);
    });

    return grouped;
  }
  // Strip trailing slashes, collapse //, ensure one leading /
  normalizePath(path) {
    if (!path) return '/';
    let p = path.replace(/\/{2,}/g, '/');     // collapse repeated slashes
    if (!p.startsWith('/')) p = '/' + p;      // enforce leading slash
    if (p.length > 1) p = p.replace(/\/+$/, ''); // strip trailing slash(es) except for root
    return p;
  }

}

// Usage example:
// const discovery = new RouteDiscovery(apos);
// const routes = await discovery.discoverRoutes();
// const grouped = discovery.groupRoutesByResource(routes);

import { promises as fs } from 'fs';
import yaml from 'js-yaml';

/**
 * Merge utilities for combining a base OpenAPI spec with discovered routes and schemas.
 *
 * Responsibilities:
 * - Load and parse a base YAML/JSON spec template
 * - Attach discovered component schemas
 * - Attach path items/operations derived from discovered routes
 * - Preserve any existing custom content in the base spec
 */
export class SpecMerger {
  /**
   * Merge the base spec with discovered routes and schemas.
   *
   * @param {string|URL} baseSpecPath - Path/URL to the base spec template file.
   * @param {Array<Object>} routes - Normalized routes with { method, path, resourceInfo, ... }.
   * @param {Object<string, Object>} schemas - Discovered component schemas keyed by name.
   * @returns {Promise<Object>} - Complete OpenAPI document as a plain JS object.
   */

  constructor() {
    this._operationIds = new Set();
  }

  async mergeSpec(baseSpecPath, routes, schemas) {
    // Load and parse the base spec
    const baseSpecContent = await fs.readFile(baseSpecPath, 'utf8');
    const baseSpec = yaml.load(baseSpecContent);

    // Start with the complete base spec as foundation
    const finalSpec = JSON.parse(JSON.stringify(baseSpec));

    // Ensure components and paths exist
    if (!finalSpec.components) {
      finalSpec.components = {};
    }
    if (!finalSpec.components.schemas) {
      finalSpec.components.schemas = {};
    }
    if (!finalSpec.paths) {
      finalSpec.paths = {};
    }

    // Merge discovered schemas into existing schemas
    this.mergeDiscoveredSchemas(finalSpec.components.schemas, schemas);

    // Generate paths from discovered routes (merge with existing paths)
    this.generatePaths(finalSpec.paths, routes, finalSpec.components.schemas);

    const originalTags = Array.isArray(finalSpec.tags) ? finalSpec.tags : [];
    const have = new Set(originalTags.map(t => t.name));
    const used = new Set();
    for (const path of Object.values(finalSpec.paths)) {
      for (const op of Object.values(path)) {
        if (op && op.tags) op.tags.forEach(t => used.add(t));
      }
    }
    const appended = [...used].filter(name => !have.has(name))
      .map(name => ({ name }));
    if (appended.length) finalSpec.tags = [...originalTags, ...appended];

    return finalSpec;
  }

  /**
   * Merge discovered component schemas into the base spec’s components.schemas,
   * preserving any existing custom definitions. Adds new properties/required fields
   * without removing what already exists.
   *
   * @param {Object<string, Object>} baseSchemas
   * @param {Object<string, Object>} discoveredSchemas
   * @returns {void}
   */
  mergeDiscoveredSchemas(baseSchemas, discoveredSchemas) {
    for (const [schemaName, schema] of Object.entries(discoveredSchemas)) {
      // Check if we already have a base schema for this type
      if (baseSchemas[schemaName]) {
        // Merge with base schema - add discovered properties to existing ones
        const existingSchema = baseSchemas[schemaName];
        if (existingSchema.properties && schema.properties) {
          // Add any new properties from discovery that aren't in base
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            if (!existingSchema.properties[propName]) {
              existingSchema.properties[propName] = propSchema;
            }
          }

          // Merge required arrays
          if (schema.required) {
            const existingRequired = new Set(existingSchema.required || []);
            schema.required.forEach(field => existingRequired.add(field));
            existingSchema.required = Array.from(existingRequired);
          }
        }
      } else {
        // Add completely new schema
        baseSchemas[schemaName] = schema;
      }
    }
  }

  /**
   * Generate/merge path items and operations from discovered routes.
   *
   * @param {Object<string, Object>} existingPaths - The spec.paths object (mutated).
   * @param {Array<Object>} routes - Normalized routes with method/path/resourceInfo.
   * @param {Object<string, Object>} schemas - Components schemas (for $ref lookups).
   * @returns {void}
   */
  generatePaths(existingPaths, routes, schemas) {
    // Group routes by path and method
    const routeGroups = this.groupRoutesByPath(routes);

    for (const [path, methods] of Object.entries(routeGroups)) {
      // Start with existing path item if it exists, or create new one
      const pathItem = existingPaths[path] || {};

      for (const [method, route] of Object.entries(methods)) {
        const methodKey = method.toLowerCase();

        // Only add the operation if it doesn't already exist
        if (!pathItem[methodKey]) {
          pathItem[methodKey] = this.generateOperation(route, schemas);
        }
      }

      // Update the paths object with merged path item
      existingPaths[path] = pathItem;
    }
  }

  /**
   * Group routes by their OpenAPI path, collecting per-method entries.
   *
   * @param {Array<Object>} routes
   * @returns {Object<string, Object<string, Object>>} e.g. { "/article": { GET: route, POST: route } }
   */
  groupRoutesByPath(routes) {
    const groups = {};

    for (const route of routes) {
      const path = route.path;
      const method = route.method.toUpperCase();

      if (!groups[path]) {
        groups[path] = {};
      }

      groups[path][method] = route;
    }

    return groups;
  }

  /**
   * Create an OpenAPI Operation Object from a normalized route record.
   *
   * @param {Object} route - Route with { method, path, resourceInfo, ... }.
   * @param {Object<string, Object>} schemas - Components schemas for $ref.
   * @returns {Object} - OpenAPI Operation Object.
   */
  generateOperation(route, schemas) {
    const resourceInfo = route.resourceInfo;
    const method = route.method.toLowerCase();
    const path = route.path;

    // Generate operation ID
    const rawId = this.generateOperationId(method, resourceInfo.resource, path);
    const operationId = this.ensureUniqueOperationId(rawId);

    // Generate summary and description
    const { summary, description } = this.generateOperationDocs(method, resourceInfo, path);

    // Base operation structure
    const operation = {
      operationId,
      summary,
      description,
      tags: [resourceInfo.tag]
    };

    // Add security requirements for all operations
    // This matches the pattern used in ApostropheCMS APIs
    operation.security = [
      { ApiKeyAuth: [] },
      { BearerAuth: [] },
      { SessionAuth: [] },
      {} // Allow unauthenticated access as fallback
    ];

    // Add parameters for path parameters
    const pathParams = this.extractPathParameters(path);
    if (pathParams.length > 0) {
      operation.parameters = pathParams.map(param => ({
        name: param,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: `${param} identifier`
      }));
    }

    // Add request/response based on method and resource type
    this.addRequestResponse(operation, method, resourceInfo, schemas);

    return operation;
  }

  /**
   * Generate a semantic operationId like listArticles, getArticle, createArticle, etc.
   *
   * @param {string} method - Lowercase HTTP method.
   * @param {string} resource - Resource key (e.g., "article").
   * @param {string} path - OpenAPI path, possibly with params.
   * @returns {string}
   */
  generateOperationId(method, resource, path) {
    // Convert method + resource + specific action to camelCase
    // GET /article -> listArticles
    // GET /article/{_id} -> getArticle  
    // POST /article -> createArticle
    // PUT /article/{_id} -> updateArticle
    // DELETE /article/{_id} -> deleteArticle

    const segments = this.splitSegments(path);

    // ignore leading “scope/prefix” segments like @apostrophecms, api, v1, etc.
    const scopeTrimmed = segments.filter((s, i) => {
      if (i === 0 && s.startsWith('@')) return false; // e.g., @apostrophecms
      if (i === 0 && (s === 'api' || /^v\d+$/i.test(s))) return false; // api, v1, v2
      return true;
    });

    const rIdx = this.findResourceIndex(scopeTrimmed, resource);
    const tail = scopeTrimmed.slice(rIdx + 1);
    const hasIdParam = tail.includes('{_id}');
    const action = tail.length && !tail[tail.length - 1].includes('{')
      ? tail[tail.length - 1]
      : null;

    let verb;
    if (method === 'get' && !hasIdParam) verb = 'list';
    else if (method === 'get' && hasIdParam) verb = 'get';
    else if (method === 'post' && !hasIdParam) verb = 'create';
    else if (method === 'put' || method === 'patch') verb = 'update';
    else if (method === 'delete') verb = 'delete';
    else verb = method;

    if (action) {
      return `${verb}${this.capitalize(resource)}${this.capitalize(action)}`;
    }

    const resourceName = (hasIdParam || ['create', 'update', 'delete'].includes(verb))
      ? resource
      : this.pluralize(resource);

    return `${verb}${this.capitalize(resourceName)}`;
  }

  /**
   * Produce a human-friendly summary/description for an operation, with context
   * for core vs pro modules and special actions.
   *
   * @param {string} method - Lowercase HTTP method.
   * @param {{ resource: string, type: string, tag: string, module: string }} resourceInfo
   * @param {string} path
   * @returns {{ summary: string, description: string }}
   */
  generateOperationDocs(method, resourceInfo, path) {
    const resource = resourceInfo.resource;
    const type = resourceInfo.type;
    const hasIdParam = path.includes('{_id}');

    let summary, description;

    if (method === 'get' && !hasIdParam) {
      summary = `List ${this.pluralize(resource)}`;
      description = `Retrieve a paginated list of ${this.pluralize(resource)}.`;
    } else if (method === 'get' && hasIdParam) {
      summary = `Get ${resource}`;
      description = `Retrieve a specific ${resource} by ID.`;
    } else if (method === 'post' && !hasIdParam) {
      summary = `Create ${resource}`;
      description = `Create a new ${resource}.`;
    } else if (method === 'put' || method === 'patch') {
      summary = `Update ${resource}`;
      description = `Update an existing ${resource}.`;
    } else if (method === 'delete') {
      summary = `Delete ${resource}`;
      description = `Delete a ${resource}.`;
    } else {
      // Handle special actions
      const pathParts = path.split('/');
      const action = pathParts[pathParts.length - 1];
      if (action && !action.includes('{')) {
        summary = `${this.capitalize(action)} ${resource}`;
        description = `${this.capitalize(action)} operation for ${resource}.`;
      } else {
        summary = `${method.toUpperCase()} ${resource}`;
        description = `${method.toUpperCase()} operation for ${resource}.`;
      }
    }

    // Add context based on module type
    if (type === 'core') {
      description += ` (Core ApostropheCMS functionality)`;
    } else if (type === 'pro') {
      description += ` (ApostropheCMS Pro feature)`;
    }

    return { summary, description };
  }

  /**
   * Attach a requestBody (when applicable) and standard responses to an operation.
   * Uses discovered schemas when available; otherwise falls back to generic objects.
   *
   * @param {Object} operation - Operation object to mutate.
   * @param {string} method - Lowercase HTTP method.
   * @param {{ resource: string }} resourceInfo
   * @param {Object<string, Object>} schemas
   * @returns {void}
   */
  addRequestResponse(operation, method, resourceInfo, schemas) {
    const schemaName = this.capitalize(resourceInfo.resource);
    const hasSchema = schemas[schemaName];

    // Add request body for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(method)) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: hasSchema
              ? { $ref: `#/components/schemas/${schemaName}` }
              : { type: 'object', additionalProperties: true }
          }
        }
      };
    }

    // Add responses
    operation.responses = {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: this.generateResponseSchema(method, schemaName, hasSchema)
          }
        }
      },
      '400': {
        $ref: '#/components/responses/BadRequest'
      },
      '401': {
        $ref: '#/components/responses/Unauthorized'
      },
      '403': {
        $ref: '#/components/responses/Forbidden'
      },
      '404': {
        $ref: '#/components/responses/NotFound'
      },
      '500': {
        $ref: '#/components/responses/InternalServerError'
      }
    };

    // Add 201 for POST (create)
    if (method === 'post') {
      operation.responses['201'] = {
        description: 'Created',
        content: {
          'application/json': {
            schema: hasSchema
              ? { $ref: `#/components/schemas/${schemaName}` }
              : { type: 'object' }
          }
        }
      };
    }

    // Add 204 for DELETE
    if (method === 'delete') {
      operation.responses['204'] = {
        description: 'No Content'
      };
    }
  }

  /**
   * Choose a response schema for an operation, preferring discovered schemas
   * when available, otherwise falling back to generic objects or a shared
   * paginated result where appropriate.
   *
   * @param {string} method - Lowercase HTTP method.
   * @param {string} schemaName - Capitalized resource name.
   * @param {boolean} hasSchema - Whether a matching schema exists in components.
   * @returns {Object} - JSON Schema for the response content.
   */
  generateResponseSchema(method, schemaName, hasSchema) {
    if (method === 'get' && !hasSchema) {
      // List endpoint without specific schema
      return { $ref: '#/components/schemas/PaginatedResponse' };
    } else if (method === 'get') {
      // Could be single item or list - simplified assumption here
      return { $ref: `#/components/schemas/${schemaName}` };
    } else if (hasSchema) {
      return { $ref: `#/components/schemas/${schemaName}` };
    } else {
      return { type: 'object', additionalProperties: true };
    }
  }

  /**
   * Extract path parameter names from an OpenAPI-style path (e.g., "/article/{_id}").
   *
   * @param {string} path
   * @returns {Array<string>}
   */
  extractPathParameters(path) {
    const matches = path.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }

  /**
   * Capitalize a word.
   * @param {string} str
   * @returns {string}
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * A very small pluralization helper for resource names.
   * @param {string} word
   * @returns {string}
   */
  pluralize(word) {
    // Simple pluralization - could be enhanced
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    } else if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch')) {
      return word + 'es';
    } else {
      return word + 's';
    }
  }

  // helper: split + strip empty segments
  splitSegments(path) {
    return path.split('/').filter(Boolean);
  }

  // helper: find the resource segment index
  findResourceIndex(segments, resource) {
    // prefer exact match, then plural, then last segment as fallback
    const plural = this.pluralize(resource);
    let idx = segments.findIndex(s => s === resource || s === plural);
    if (idx === -1) idx = Math.max(segments.length - 1, 0);
    return idx;
  }

  ensureUniqueOperationId(id) {
    let candidate = id, i = 2;
    while (this._operationIds.has(candidate)) {
      candidate = `${id}${i++}`; // e.g., getArticle → getArticle2
    }
    this._operationIds.add(candidate);
    return candidate;
  }
};

// Schema discovery logic for OpenAPI spec generation

/**
 * Utilities for discovering and converting ApostropheCMS module schemas
 * into OpenAPI-compatible component schemas.
 *
 * Responsibilities:
 * - Collect schemas from all modules with fields
 * - Normalize field definitions into JSON Schema—like objects
 * - Apply optional custom mappers defined in the generator module
 * - Handle relationships and special field types
 */
export class SchemaDiscovery {
  /**
   * @param {any} apos - Apostrophe instance.
   */
  constructor(apos) {
    this.apos = apos;
    this.fieldTypeMap = this.buildFieldTypeMap();
    this.generatorModule = apos.modules['openapi-generator'];
  }

  /**
   * Discover schemas from all modules that expose fields.
   *
   * @returns {Promise<Object<string, any>>} Object keyed by schema name
   */
  async discoverSchemas() {
    const schemas = {};
    const modulesWithSchemas = this.getModulesWithSchemas();

    for (const [moduleName, module] of Object.entries(modulesWithSchemas)) {
      try {
        const moduleSchemas = this.extractModuleSchemas(moduleName, module);
        Object.assign(schemas, moduleSchemas);
      } catch (error) {
        console.warn(`Warning: Could not extract schemas from ${moduleName}:`, error.message);
      }
    }

    return schemas;
  }

  /**
   * Return all Apostrophe modules for potential schema inspection.
   *
   * @returns {Record<string, any>}
   */
  getModulesWithSchemas() {
    return this.apos.modules;
  }

  /**
   * Extract and convert schemas from a single module.
   *
   * @param {string} moduleName
   * @param {any} module
   * @returns {Object<string, any>}
   */
  extractModuleSchemas(moduleName, module) {
    const schemas = {};
    const fields = this.getModuleFields(module);

    if (!fields || Object.keys(fields).length === 0) {
      return schemas;
    }

    const schemaName = this.generateSchemaName(moduleName);
    const openApiSchema = this.convertFieldsToOpenApiSchema(fields, moduleName, module);

    if (openApiSchema && Object.keys(openApiSchema.properties || {}).length > 0) {
      schemas[schemaName] = openApiSchema;
    }

    return schemas;
  }

  /**
   * Retrieve fields from a module using the compiled schema when available.
   * Falls back to manual field collection if the compiled schema isn't accessible.
   *
   * @param {any} module
   * @returns {Record<string, any>}
   */
  getModuleFields(module) {
    // First, try to get the fully compiled schema from the module
    // This is set by @apostrophecms/doc-type and contains all inherited fields
    if (Array.isArray(module.schema)) {
      console.log(`Using compiled schema for ${module.name || 'unknown'} (${module.schema.length} fields)`);

      const fields = module.schema
        .filter(f => f && f.name)
        .reduce((acc, f) => {
          acc[f.name] = f;
          return acc;
        }, {});

      // Add core document fields that ApostropheCMS handles automatically but aren't in schema
      this.addImplicitCoreFields(fields, module);

      return fields;
    }

    // Check if the module has a getSchema method as fallback
    if (typeof module.getSchema === 'function') {
      try {
        const schema = module.getSchema();
        if (Array.isArray(schema)) {
          console.log(`Using getSchema() for ${module.name || 'unknown'} (${schema.length} fields)`);

          const fields = schema
            .filter(f => f && f.name)
            .reduce((acc, f) => {
              acc[f.name] = f;
              return acc;
            }, {});

          this.addImplicitCoreFields(fields, module);
          return fields;
        }
      } catch (error) {
        console.warn(`getSchema() failed for ${module.name}:`, error.message);
      }
    }

    // Failure warning
    console.log(`Skipping module ${module.name}: no schema available`);
    return {};
  }

  /**
   * Add core fields that ApostropheCMS handles implicitly but aren't in the schema definition.
   * These fields are added by the database layer and doc-type system.
   *
   * @param {Record<string, any>} fields
   * @param {any} module
   */
  addImplicitCoreFields(fields, module) {
    // Core fields that exist on all ApostropheCMS documents but aren't in schema
    const implicitFields = {
      '_id': {
        name: '_id',
        type: 'string',
        label: 'Document ID',
        required: true,
        readOnly: true
      },
      'type': {
        name: 'type',
        type: 'string',
        label: 'Document Type',
        required: true,
        readOnly: true
      },
      'createdAt': {
        name: 'createdAt',
        type: 'datetime',
        label: 'Created At',
        readOnly: true
      },
      'updatedAt': {
        name: 'updatedAt',
        type: 'datetime',
        label: 'Updated At',
        readOnly: true
      }
    };

    // Add implicit fields if they don't already exist
    for (const [fieldName, fieldDef] of Object.entries(implicitFields)) {
      if (!fields[fieldName]) {
        fields[fieldName] = fieldDef;
      }
    }

    // Add page-specific implicit fields
    if (this.isPageType(module)) {
      const pageFields = {
        'path': {
          name: 'path',
          type: 'string',
          label: 'Page Path',
          readOnly: true
        },
        'rank': {
          name: 'rank',
          type: 'integer',
          label: 'Page Rank'
        },
        'level': {
          name: 'level',
          type: 'integer',
          label: 'Page Level',
          readOnly: true
        }
      };

      for (const [fieldName, fieldDef] of Object.entries(pageFields)) {
        if (!fields[fieldName]) {
          fields[fieldName] = fieldDef;
        }
      }
    }
  }

  /**
   * Generate a schema name from a module name.
   * Examples:
   * - @apostrophecms/user → User
   * - my-custom-piece → MyCustomPiece
   *
   * @param {string} moduleName
   * @returns {string}
   */
  generateSchemaName(moduleName) {
    let name = moduleName;
    if (name.startsWith('@apostrophecms/')) name = name.replace('@apostrophecms/', '');
    if (name.startsWith('@apostrophecms-pro/')) name = name.replace('@apostrophecms-pro/', '');
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Convert Apostrophe fields into an OpenAPI schema object.
   *
   * @param {Record<string, any>} fields
   * @param {string} moduleName
   * @param {any} module
   * @returns {Object} OpenAPI schema
   */
  convertFieldsToOpenApiSchema(fields, moduleName, module) {
    const properties = {};
    const required = [];

    // Process all discovered fields (now includes implicit core fields)
    for (const [fieldName, field] of Object.entries(fields)) {
      // Skip private fields but allow _id since it's essential for APIs
      if (
        field.name &&
        field.name.startsWith('_') &&
        field.name !== '_id' &&
        field.type !== 'relationship'
      ) continue;

      const openApiField = this.convertFieldToOpenApiProperty(field);
      if (openApiField) {
        properties[field.name] = openApiField;
        if (field.required) required.push(field.name);
      }
    }

    const schema = { type: 'object', properties };
    if (required.length > 0) schema.required = required;
    schema.description = this.generateSchemaDescription(moduleName);

    return schema;
  }

  /**
   * Check if a module is a piece type.
   *
   * @param {any} module
   * @returns {boolean}
   */
  isPieceType(module) {
    return module && (
      module.__meta?.chain?.includes('@apostrophecms/piece-type') ||
      module.options?.extend === '@apostrophecms/piece-type' ||
      (module.name && module.name !== '@apostrophecms/piece-type' &&
      this.apos.modules['@apostrophecms/piece-type'] &&
      module.__proto__ === this.apos.modules['@apostrophecms/piece-type'].__proto__)
    );
  }

  /**
   * Check if a module is a page type.
   *
   * @param {any} module
   * @returns {boolean}
   */
  isPageType(module) {
    return module && (
      module.__meta?.chain?.includes('@apostrophecms/page-type') ||
      module.options?.extend === '@apostrophecms/page-type' ||
      module.name === '@apostrophecms/page'
    );
  }

  /**
   * Convert a single Apostrophe field to an OpenAPI property.
   * Applies custom field mappers if defined.
   *
   * @param {any} field
   * @returns {Object}
   */
  convertFieldToOpenApiProperty(field) {
    const fieldType = field.type;

    const customMappers = this.generatorModule?.options?.openapiFieldMappers || {};
    if (customMappers[fieldType]) {
      try {
        return customMappers[fieldType](field);
      } catch (error) {
        console.warn(`Custom field mapper for ${fieldType} failed:`, error.message);
      }
    }

    const mapping = this.fieldTypeMap[fieldType];
    if (!mapping) {
      return {
        type: 'object',
        description: `Custom field type: ${fieldType}`, 
        additionalProperties: true
      };
    }

    let property = { ...mapping.schema };

    if (field.label) property.title = field.label;
    if (field.help) property.description = field.help;
    if (field.min !== undefined) property.minimum = field.min;
    if (field.max !== undefined) property.maximum = field.max;
    if (field.def !== undefined) property.default = field.def;

    // Handle choices/enum fields properly
    if (Array.isArray(field.choices)) {
      property.enum = field.choices.map(choice =>
        typeof choice === 'object' ? choice.value : choice
      );
    }

    // Special handling for specific field types
    if (fieldType === 'relationship') {
      property = this.handleRelationshipField(field, property);
    } else if (fieldType === 'checkboxes' || fieldType === 'tags') {
      // Ensure array fields have proper items schema
      property = this.handleArrayField(field, property);
    }

    return property;
  }

  /**
   * Handle array fields like checkboxes and tags to ensure proper items schema.
   *
   * @param {any} field
   * @param {Object} property
   * @returns {Object}
   */
  handleArrayField(field, property) {
    if (property.type === 'array' && !property.items) {
      property.items = { type: 'string' };
    }

    // For checkboxes with choices, add enum to items
    if (field.type === 'checkboxes' && Array.isArray(field.choices)) {
      property.items = {
        type: 'string',
        enum: field.choices.map(choice =>
          typeof choice === 'object' ? choice.value : choice
        )
      };
      // Remove enum from the array level
      delete property.enum;
    }

    return property;
  }

  /**
   * Handle relationship fields by mapping them to $ref or arrays of $ref.
   *
   * @param {any} field
   * @param {Object} property
   * @returns {Object}
   */
  handleRelationshipField(field, property) {
    const withType = field.withType;
    if (withType) {
      const relatedSchema = this.generateSchemaName(withType);
      if (field.max === 1) {
        property = { $ref: `#/components/schemas/${relatedSchema}` };
      } else {
        property = {
          type: 'array',
          items: { $ref: `#/components/schemas/${relatedSchema}` } 
        };
      }
    }
    return property;
  }

  /**
   * Generate schema description text.
   *
   * @param {string} moduleName
   * @returns {string}
   */
  generateSchemaDescription(moduleName) {
    const descriptions = {
      '@apostrophecms/user': 'User account and profile information',
      '@apostrophecms/image': 'Image asset with metadata and crops',
      '@apostrophecms/file': 'File attachment with metadata',
      '@apostrophecms/page': 'Page content and hierarchy',
      '@apostrophecms/global': 'Global site content and settings'
    };

    if (descriptions[moduleName]) return descriptions[moduleName];
    return `${this.generateSchemaName(moduleName)} content type`;
  }

  /**
   * Build a mapping of Apostrophe field types to OpenAPI schema types.
   *
   * @returns {Record<string, { schema: Object }>}
   */
  buildFieldTypeMap() {
    return {
      string: { schema: { type: 'string' } },
      textarea: { schema: { type: 'string' } },
      editor: { schema: { type: 'string', format: 'html' } },
      integer: { schema: { type: 'integer' } },
      float: { schema: { type: 'number' } },
      boolean: { schema: { type: 'boolean' } },
      date: { schema: { type: 'string', format: 'date' } },
      datetime: { schema: { type: 'string', format: 'date-time' } },
      time: { schema: { type: 'string', format: 'time' } },
      email: { schema: { type: 'string', format: 'email' } },
      url: { schema: { type: 'string', format: 'uri' } },
      slug: { schema: { type: 'string', pattern: '^[a-z0-9-]+$' } },
      tags: { schema: { type: 'array', items: { type: 'string' } } },
      checkboxes: { schema: { type: 'array', items: { type: 'string' } } },
      select: { schema: { type: 'string' } },
      radio: { schema: { type: 'string' } },
      attachment: { schema: { type: 'object', description: 'File attachment reference' } },
      area: { schema: { type: 'object', description: 'Rich content area with widgets' } },
      array: { schema: { type: 'array', items: { type: 'object' } } },
      object: { schema: { type: 'object' } },
      relationship: { schema: { type: 'object', description: 'Reference to related content' } },
      password: { schema: { type: 'string', format: 'password' } },
      oembed: { schema: { type: 'object', description: 'Embedded media content (video, etc.)' } },
      role: { schema: { type: 'string', description: 'User role assignment' } }
    };
  }
}
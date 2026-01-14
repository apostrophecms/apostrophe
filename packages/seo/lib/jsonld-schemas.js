const _ = require('lodash');
const { getImageData } = require('./utils');
class JsonLdSchemaHandler {
  constructor(customSchemas = {}, seoFieldMappings = {}) {
    this.schemas = {
      WebSite: this.getWebsiteSchema,
      Organization: this.getOrganizationSchema,
      Article: this.getArticleSchema,
      BlogPosting: this.getBlogPostingSchema,
      WebPage: this.getWebPageSchema,
      CollectionPage: this.getCollectionPageSchema,
      Product: this.getProductSchema,
      Event: this.getEventSchema,
      Person: this.getPersonSchema,
      LocalBusiness: this.getLocalBusinessSchema,
      JobPosting: this.getJobPostingSchema,
      FAQPage: this.getFAQPageSchema,
      QAPage: this.getQAPageSchema,
      VideoObject: this.getVideoSchema,
      HowTo: this.getHowToSchema,
      Review: this.getReviewSchema,
      Recipe: this.getRecipeSchema,
      Course: this.getCourseSchema,
      Offer: this.getOfferSchema,
      AggregateOffer: this.getAggregateOfferSchema,
      ...customSchemas
    };

    // Store custom field mappings
    // Allows developers to override default field names like:
    // { author: 'authorName', image: 'heroImage', description: 'summary' }
    this.seoFieldMappings = seoFieldMappings;
  }

  // Debug logging helper - only logs when APOS_SEO_DEBUG is enabled
  logDebug(message, ...data) {
    if (process.env.APOS_SEO_DEBUG) {
      console.warn(`[SEO] ${message}`, ...data);
    }
  }

  // Helper method: Get field value respecting custom field mappings
  // fieldType: 'author', 'image', 'description', 'publishedAt', etc.
  // obj: The object to search (document or schemaData)
  // Returns the field name that was actually used
  getFieldName(fieldType, obj) {
    // Check if there's a custom mapping for this field type
    const customField = this.seoFieldMappings[fieldType];

    if (customField && obj?.[customField] !== undefined) {
      return customField;
    }

    // Fall back to default field names
    return null;
  }

  // Helper method: Get author name with fallback chain
  getAuthorName(schemaData, document) {
    let authorName = null;
    let fallbackSource = null;

    // Check for custom field mapping first
    const customAuthorField = this.getFieldName('author', document);
    if (customAuthorField) {
      const customValue = document[customAuthorField];
      if (typeof customValue === 'string' && customValue.trim()) {
        authorName = customValue;
        fallbackSource = `document.${customAuthorField} (custom mapping)`;
      } else if (Array.isArray(customValue) && customValue[0]) {
        authorName = customValue[0].title || customValue[0].username;
        fallbackSource = `document.${customAuthorField}[0] (custom mapping)`;
      }
    }

    // Standard fallback chain if no custom mapping or custom field empty
    if (!authorName) {
      // 1. Check schema-specific author string field
      // 2. Check document-level author string field
      // 3. Check _author relationship array
      // 4. Fall back to updatedBy user if available
      if (schemaData?.author?.trim()) {
        authorName = schemaData.author;
        fallbackSource = 'schema.author';
      } else if (document?.author?.trim()) {
        authorName = document.author;
        fallbackSource = 'document.author';
      } else if (document?._author?.length) {
        const relAuthor = document._author[0];
        authorName = relAuthor.title || relAuthor.name;
        fallbackSource = 'document._author[0]';
      } else if (document?.updatedBy) {
        const updatedBy = document.updatedBy;
        authorName = updatedBy.title || updatedBy.username;
        fallbackSource = 'document.updatedBy';
      }
    }

    if (authorName && fallbackSource) {
      this.logDebug(`Author fallback used: ${fallbackSource} = "${authorName}"`);
    }

    return authorName;
  }

  // Helper method: Get image data with fallback chain
  getImageDataWithFallbacks(schemaData, document) {
    let imageData = null;
    let fallbackSource = null;

    // Check for custom field mapping first
    const customImageField = this.getFieldName('image', document);
    if (customImageField) {
      const customValue = document[customImageField];
      // Handle relationship format (array)
      if (Array.isArray(customValue)) {
        imageData = getImageData(customValue);
        if (imageData) {
          fallbackSource = `document.${customImageField} (custom mapping)`;
        }
      } else if (customValue?.url) {
        // Handle simple object format with url
        imageData = {
          url: customValue.url,
          alt: customValue.alt,
          width: customValue.width,
          height: customValue.height
        };
        fallbackSource = `document.${customImageField} (custom mapping)`;
      } else if (customValue?._urls) {
        // Handle attachment format
        imageData = {
          url: customValue._urls.original || customValue._urls.full,
          alt: document.alt || customValue.title || '',
          width: customValue.width,
          height: customValue.height,
          _urls: customValue._urls
        };
        fallbackSource = `document.${customImageField} (custom mapping)`;
      }
    }

    // Standard fallback chain if no custom mapping or custom field empty
    if (!imageData) {
      // 1. Check schema-specific image relationship
      if (schemaData?._image) {
        imageData = getImageData(schemaData._image);
        if (imageData) {
          fallbackSource = 'schema._image';
        }
      }

      // 2. Fallback to document _featuredImage relationship
      if (!imageData && document?._featuredImage) {
        imageData = getImageData(document._featuredImage);
        if (imageData) {
          fallbackSource = 'document._featuredImage';
        }
      }

      // 3. Fallback to attachment field directly on the document
      if (!imageData && document?.attachment?._urls) {
        const attachment = document.attachment;
        imageData = {
          url: attachment._urls.original || attachment._urls.full,
          alt: document.alt || attachment.title || '',
          width: attachment.width,
          height: attachment.height,
          _urls: attachment._urls
        };
        fallbackSource = 'document.attachment';
      }

      // 4. Fallback to simple featuredImage object with url
      if (!imageData && document?.featuredImage?.url) {
        imageData = {
          url: document.featuredImage.url,
          alt: document.featuredImage.alt,
          width: document.featuredImage.width,
          height: document.featuredImage.height
        };
        fallbackSource = 'document.featuredImage';
      }

      // 5. Fallback to simple image object with url
      if (!imageData && document?.image?.url) {
        imageData = {
          url: document.image.url,
          alt: document.image.alt,
          width: document.image.width,
          height: document.image.height
        };
        fallbackSource = 'document.image';
      }
    }

    if (imageData && fallbackSource) {
      this.logDebug(`Image fallback used: ${fallbackSource}`);
    }

    return imageData;
  }

  // Helper method: Get description with fallback chain
  getDescriptionWithFallbacks(schemaData, document) {
    let description = null;
    let fallbackSource = null;

    // Check for custom field mapping first
    const customDescField = this.getFieldName('description', document);
    if (customDescField && document[customDescField]?.trim()) {
      description = document[customDescField];
      fallbackSource = `document.${customDescField} (custom mapping)`;
    }

    // Standard fallback chain if no custom mapping or custom field empty
    if (!description) {
      if (schemaData?.description?.trim()) {
        // 1. Schema-specific description
        description = schemaData.description;
        fallbackSource = 'schema.description';
      } else if (document?.seoDescription?.trim()) {
        // 2. Document seoDescription
        description = document.seoDescription;
        fallbackSource = 'document.seoDescription';
      } else if (document?.excerpt?.trim()) {
        // 3. Document excerpt
        description = document.excerpt;
        fallbackSource = 'document.excerpt';
      } else if (document?.description?.trim()) {
        // 4. Document description
        description = document.description;
        fallbackSource = 'document.description';
      }
    }

    if (description && fallbackSource !== 'schema.description') {
      this.logDebug(`Description fallback used: ${fallbackSource}`);
    }

    return description;
  }

  // Helper method: Get date with fallback chain
  getDateWithFallbacks(schemaData, document, dateType = 'published') {
    let date = null;
    let fallbackSource = null;

    if (dateType === 'published') {
      // Check for custom field mapping first
      const customDateField = this.getFieldName('publishedAt', document);
      if (customDateField && document[customDateField]) {
        date = document[customDateField];
        fallbackSource = `document.${customDateField} (custom mapping)`;
      }

      // Standard fallback chain if no custom mapping or custom field empty
      if (!date) {
        if (schemaData?.datePublished) {
          // 1. Schema-specific date
          date = schemaData.datePublished;
          fallbackSource = 'schema.datePublished';
        } else if (schemaData?.publicationDate) {
          // 2. Alternative schema field
          date = schemaData.publicationDate;
          fallbackSource = 'schema.publicationDate';
        } else if (document?.publishedAt) {
          // 3. Document publishedAt
          date = document.publishedAt;
          fallbackSource = 'document.publishedAt';
        } else if (document?.publicationDate) {
          // 4. Document publicationDate
          date = document.publicationDate;
          fallbackSource = 'document.publicationDate';
        } else if (document?.datePublished) {
          // 5. Document datePublished
          date = document.datePublished;
          fallbackSource = 'document.datePublished';
        } else if (document?.createdAt) {
          // 6. Fall back to createdAt
          date = document.createdAt;
          fallbackSource = 'document.createdAt';
        }
      }
    } else if (dateType === 'modified') {
      // For modified dates
      if (document?.updatedAt) {
        date = document.updatedAt;
        fallbackSource = 'document.updatedAt';
      } else if (document?.createdAt) {
        date = document.createdAt;
        fallbackSource = 'document.createdAt';
      }
    }

    if (date && fallbackSource && !fallbackSource.startsWith('schema.')) {
      this.logDebug(`Date (${dateType}) fallback used: ${fallbackSource}`);
    }

    return date;
  }

  generateSchemas(data) {
    const {
      page,
      piece,
      global
    } = data;

    // building the graph for this request
    const document = piece || page;

    const schemas = [];

    // Always include WebSite schema if we have site data
    if ((global?.seoSiteName || global?.title)) {
      const websiteSchema = this.getWebsiteSchema(data);
      if (websiteSchema) {
        schemas.push(websiteSchema);
      }
    }

    // Add Organization schema if configured with actual data
    if (global?.seoJsonLdOrganization?.name) {
      const orgSchema = this.getOrganizationSchema(data);
      if (orgSchema) {
        schemas.push(orgSchema);
      }
    }

    // Add document-specific schema based on type
    if (document?.seoJsonLdType) {
      const schemaGenerator = this.schemas[document.seoJsonLdType];
      if (schemaGenerator) {
        const documentSchema = schemaGenerator.call(this, data);
        if (documentSchema) {
          schemas.push(documentSchema);
        }
      }
    }

    // Add ItemList for listing pages if items are present and toggle allows
    const items = this.getListingItems(data);
    const isDetailDoc = !!piece; // heuristic: piece detail pages shouldn't emit ItemList
    const includeItemList = !isDetailDoc && items.length > 0 && (
      document?.seoIncludeItemList === true ||
      (document?.seoIncludeItemList === undefined && document?.seoJsonLdType === 'CollectionPage')
    );
    if (includeItemList) {
      const itemList = this.getItemListSchema(data, items);
      if (itemList) {
        schemas.push(itemList);
      }
    }

    // Add BreadcrumbList for pages(skip on piece detail)
    if (!isDetailDoc && page) {
      const breadcrumbs = this.getBreadcrumbListSchema(data);
      if (breadcrumbs) {
        schemas.push(breadcrumbs);
      }
    }

    return schemas.filter(schema => schema !== null);
  }

  getWebsiteSchema(data) {
    const { global } = data;
    const baseUrl = this.getBaseUrl(data);

    if (!global.seoSiteName) {
      return null;
    }

    const websiteId = baseUrl ? `${baseUrl}/#website` : undefined;
    const schema = {
      '@type': 'WebSite',
      '@id': websiteId,
      name: global.seoSiteName
    };

    if (baseUrl) {
      schema.url = baseUrl;
    }

    if (global?.seoSiteDescription?.trim()) {
      schema.description = global.seoSiteDescription;
    }

    // Add search action if we have a base URL
    if (baseUrl) {
      const searchParam = global.seoSearchQueryParam || 'q';
      schema.potentialAction = {
        '@type': 'SearchAction',
        target: `${baseUrl}/search?${searchParam}={search_term_string}`,
        'query-input': 'required name=search_term_string'
      };
    }

    return schema;
  }

  getOrganizationSchema(data) {
    const { global } = data;
    const org = global?.seoJsonLdOrganization;

    if (!org?.name?.trim()) {
      return null;
    }

    const baseUrl = this.getBaseUrl(data);
    const orgId = baseUrl ? `${baseUrl}/#org` : undefined;
    const schema = {
      '@type': org.type || 'Organization',
      '@id': orgId,
      name: org.name
    };

    if (baseUrl) {
      schema.url = baseUrl;
    }

    // Only add description if it exists and has content
    if (org.description?.trim()) {
      schema.description = org.description;
    }

    // Only add logo if it exists with URLs
    if (org._logo) {
      const logoImage = getImageData(org._logo);
      if (logoImage) {
        schema.logo = {
          '@type': 'ImageObject',
          url: logoImage.url
        };
      }
    }

    // Only add contact point if telephone exists
    if (org.contactPoint?.telephone?.trim()) {
      schema.contactPoint = {
        '@type': 'ContactPoint',
        telephone: org.contactPoint.telephone,
        contactType: org.contactPoint.type || 'customer service'
      };
    }

    // Only add address if we have meaningful address data
    const addr = org.address;
    if (addr && (addr.street?.trim() || addr.city?.trim())) {
      schema.address = {
        '@type': 'PostalAddress'
      };

      if (addr.street?.trim()) {
        schema.address.streetAddress = addr.street;
      }
      if (addr.city?.trim()) {
        schema.address.addressLocality = addr.city;
      }
      if (addr.state?.trim()) {
        schema.address.addressRegion = addr.state;
      }
      if (addr.zip?.trim()) {
        schema.address.postalCode = addr.zip;
      }
      if (addr.country?.trim()) {
        schema.address.addressCountry = addr.country;
      }
    }
    if (global?.seoSocialProfiles?.length) {
      const validUrls = global.seoSocialProfiles
        .filter(item => item.profileUrl?.trim())
        .map(item => item.profileUrl);

      if (validUrls.length > 0) {
        schema.sameAs = validUrls;
      }
    }

    return schema;
  }

  getArticleSchema(data) {
    const { piece, page } = data;
    const baseUrl = this.getBaseUrl(data);
    const document = piece || page;

    if (!document) {
      return null;
    }

    const schema = {
      '@type': 'Article',
      headline: document.seoTitle || document.title
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      schema['@id'] = `${document._url}#article`;
      schema.url = document._url;
    } else if (baseUrl && document.slug) {
      schema['@id'] = `${baseUrl}${document.slug}#article`;
    }

    if (data.req?.locale) {
      schema.inLanguage = data.req.locale;
    }

    // Use description fallback helper
    const description = this.getDescriptionWithFallbacks(null, document);
    if (description) {
      schema.description = description;
    }

    // Use date fallback helpers
    const datePublished = this.getDateWithFallbacks(null, document, 'published');
    if (datePublished) {
      schema.datePublished = datePublished;
    }

    const dateModified = this.getDateWithFallbacks(null, document, 'modified');
    if (dateModified) {
      schema.dateModified = dateModified;
    }

    // Use author fallback helper
    const authorName = this.getAuthorName(null, document, data.req);
    if (authorName) {
      schema.author = {
        '@type': 'Person',
        name: authorName
      };
    }

    // Add publisher from global org data
    const global = data.global;
    if (global?.seoJsonLdOrganization?.name?.trim()) {
      schema.publisher = {
        '@type': 'Organization',
        name: global.seoJsonLdOrganization.name
      };

      if (baseUrl) {
        schema.publisher['@id'] = `${baseUrl}/#org`;
      }

      const publisherLogo = getImageData(global.seoJsonLdOrganization._logo);
      if (publisherLogo) {
        schema.publisher.logo = {
          '@type': 'ImageObject',
          url: publisherLogo.url
        };
      }
    }

    if (document.seoIsPaywalled) {
      schema.isAccessibleForFree = false;
      schema.hasPart = {
        '@type': 'WebPageElement',
        isAccessibleForFree: false,
        cssSelector: document.seoPaywallSelector || '.paywall'
      };
    }

    return schema;
  }

  getBlogPostingSchema(data) {
    const schema = this.getArticleSchema(data);

    if (schema) {
      schema['@type'] = 'BlogPosting';
      if (schema['@id']) {
        schema['@id'] = schema['@id'].replace('#article', '#blogposting');
      }
    }

    return schema;
  }

  getWebPageSchema(data) {
    const { piece, page } = data;
    const baseUrl = this.getBaseUrl(data);
    const document = piece || page;

    if (!document) {
      return null;
    }

    const schema = {
      '@type': 'WebPage',
      headline: document.seoTitle || document.title
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      schema['@id'] = `${document._url}#webpage`;
      schema.url = document._url;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      schema['@id'] = `${baseUrl}${document.slug}#article`;
    }

    if (data.req?.locale) {
      schema.inLanguage = data.req.locale;
    }
    if (baseUrl) {
      schema.isPartOf = { '@id': `${baseUrl}/#website` };
    }

    if (document.seoDescription?.trim()) {
      schema.description = document.seoDescription;
    }

    if (document.publishedAt || document.createdAt) {
      schema.datePublished = document.publishedAt || document.createdAt;
    }

    if (document.updatedAt || document.createdAt) {
      schema.dateModified = document.updatedAt || document.createdAt;
    }

    if (document.seoIsPaywalled) {
      schema.isAccessibleForFree = false;
      schema.hasPart = {
        '@type': 'WebPageElement',
        isAccessibleForFree: false,
        cssSelector: document.seoPaywallSelector || '.paywall'
      };
    }

    return schema;
  }

  getCollectionPageSchema(data) {
    const { piece, page } = data;
    const baseUrl = this.getBaseUrl(data);
    const document = piece || page;

    if (!document) {
      return null;
    }

    const schema = {
      '@type': 'CollectionPage',
      name: document.seoTitle || document.title
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      schema['@id'] = `${document._url}#collection`;
      schema.url = document._url;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      schema['@id'] = `${baseUrl}${document.slug}#article`;
    }

    if (data.req?.locale) {
      schema.inLanguage = data.req.locale;
    }
    if (baseUrl) {
      schema.isPartOf = { '@id': `${baseUrl}/#website` };
    }

    if (document.seoDescription?.trim()) {
      schema.description = document.seoDescription;
    }

    if (document.publishedAt || document.createdAt) {
      schema.datePublished = document.publishedAt || document.createdAt;
    }

    if (document.updatedAt || document.createdAt) {
      schema.dateModified = document.updatedAt || document.createdAt;
    }

    return schema;
  }

  getProductSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const product = document?.seoJsonLdProduct;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !product || !product.name?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'Product',
      name: product.name
    };
    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#product`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#product`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(product, document);
    if (description) {
      schema.description = description;
    }

    // Add offers if price is provided
    if (product.price && product.price > 0) {
      schema.offers = {
        '@type': 'Offer',
        price: product.price.toString(),
        priceCurrency: product.currency || 'USD'
      };

      if (product.availability) {
        schema.offers.availability = `https://schema.org/${product.availability}`;
      }
    }

    // Add brand if provided
    if (product.brand?.trim()) {
      schema.brand = {
        '@type': 'Brand',
        name: product.brand
      };
    }

    // Add aggregate rating
    if (product.rating && product.reviewCount) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: product.rating.toString(),
        reviewCount: product.reviewCount.toString(),
        bestRating: '5',
        worstRating: '1'
      };
    }

    // Add SKU
    if (product.sku?.trim()) {
      schema.sku = product.sku;
    }

    // Add GTIN (barcode)
    if (product.gtin?.trim()) {
      schema.gtin = product.gtin;
    }

    // Add condition
    if (product.condition) {
      schema.itemCondition = `https://schema.org/${product.condition}`;
    }

    // Add image if available
    const productImage = this.getImageDataWithFallbacks(product, document);
    if (productImage) {
      schema.image = productImage.url;
    } else {
      this.logDebug('Product schema missing recommended image field:', document._url || document.slug);
    }

    return schema;
  }

  getEventSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const event = document?.seoJsonLdEvent;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !event || !event.name?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'Event',
      name: event.name
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#event`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#event`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(event, document);
    if (description) {
      schema.description = description;
    }

    if (event.startDate) {
      schema.startDate = event.startDate;
    }

    if (event.endDate) {
      schema.endDate = event.endDate;
    }

    // Add location if provided
    if (event.location?.name?.trim()) {
      schema.location = {
        '@type': 'Place',
        name: event.location.name
      };

      if (event.location.address?.trim()) {
        schema.location.address = event.location.address;
      }
    }

    return schema;
  }

  getPersonSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const person = document?.seoJsonLdPerson;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !person || !person.name?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'Person',
      name: person.name
    };
    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#person`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#person`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(person, document);
    if (description) {
      schema.description = description;
    }

    if (person.jobTitle?.trim()) {
      schema.jobTitle = person.jobTitle;
    }

    if (person.organization?.trim()) {
      schema.worksFor = {
        '@type': 'Organization',
        name: person.organization
      };
    }

    return schema;
  }

  getLocalBusinessSchema(data) {
    const {
      piece,
      page,
      global
    } = data;
    const document = piece || page;
    const baseUrl = this.getBaseUrl(data);
    const business = document?.seoJsonLdBusiness || global?.seoJsonLdBusiness;
    const isDocumentSpecific = document?.seoJsonLdBusiness;

    if (!business || !business.name?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'LocalBusiness',
      name: business.name
    };

    // Only add @id if we have a complete URL and it isn't a global setting
    if (isDocumentSpecific) {
      if (document._url) {
        const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
        schema['@id'] = `${absoluteUrl}#localbusiness`;
        schema.url = absoluteUrl;
      } else if (baseUrl && document.slug) {
        // Fallback: construct URL from baseUrl + slug
        const absoluteUrl = `${baseUrl}/${document.slug}`;
        schema['@id'] = `${absoluteUrl}#localbusiness`;
        schema.url = absoluteUrl;
      }
    } else {
      schema.url = baseUrl;
    }

    const description = this.getDescriptionWithFallbacks(business, document);
    if (description) {
      schema.description = description;
    }

    // Add address if we have meaningful data
    const addr = business.address;
    if (addr && (addr.street?.trim() || addr.city?.trim())) {
      schema.address = {
        '@type': 'PostalAddress'
      };

      if (addr.street?.trim()) {
        schema.address.streetAddress = addr.street;
      }
      if (addr.city?.trim()) {
        schema.address.addressLocality = addr.city;
      }
      if (addr.state?.trim()) {
        schema.address.addressRegion = addr.state;
      }
      if (addr.zip?.trim()) {
        schema.address.postalCode = addr.zip;
      }
      if (addr.country?.trim()) {
        schema.address.addressCountry = addr.country;
      }
    }

    if (business.telephone?.trim()) {
      schema.telephone = business.telephone;
    }

    if (business.openingHours?.length) {
      const validHours = business.openingHours
        .filter(item => item.hours?.trim())
        .map(item => item.hours);

      if (validHours.length > 0) {
        schema.openingHours = validHours;
      }
    }

    return schema;
  }

  // helper: get the site base URL consistently
  getBaseUrl(data) {
    const fromGlobal = data.global?.seoSiteCanonicalUrl;
    if (fromGlobal) {
      return fromGlobal.replace(/\/$/, '');
    }
    const abs = data.req?.absoluteUrl;

    if (abs) {
      try {
        return new URL(abs).origin;
      } catch (e) { }
    }

    return null;
  }

  // helper: ensure URL is absolute
  ensureAbsoluteUrl(url, baseUrl) {
    if (!url) {
      return null;
    }
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return url;
    }
  }

  // helper: find listing items on an index page
  getListingItems(data) {
    // Try common keys used by Apostrophe listing pages
    const candidates = [
      data.pieces,
      data.items,
      data._pieces,
      data.docs
    ].filter(Boolean);

    const list = (Array.isArray(candidates[0]) ? candidates[0] : [])
      .filter(d => d && (d._url || d.url) && (d.title || d.seoTitle));

    return list;
  }

  // Build an ItemList from listing items
  getItemListSchema(data, itemsArg) {
    const items = itemsArg || this.getListingItems(data);
    if (!items || items.length === 0) {
      return null;
    }

    return {
      '@type': 'ItemList',
      itemListOrder: 'http://schema.org/ItemListOrderAscending',
      numberOfItems: items.length,
      itemListElement: items.map((d, i) => {
        const listItem = {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': this.getSchemaTypeForListItem(d),
            name: d.seoTitle || d.title,
            url: d._url || d.url
          }
        };

        // Add image if available (richer snippet potential)
        const itemImage = getImageData(d._featuredImage);
        if (itemImage) {
          listItem.item.image = itemImage.url;
        }

        // Add description if available
        if (d.seoDescription || d.excerpt) {
          listItem.item.description = d.seoDescription || d.excerpt;
        }

        return listItem;
      })
    };
  }

  getSchemaTypeForListItem(doc) {
    if (doc.seoJsonLdType) {
      return doc.seoJsonLdType;
    }

    const typeMap = {
      article: 'Article',
      'blog-post': 'BlogPosting',
      product: 'Product',
      event: 'Event',
      person: 'Person',
      '@apostrophecms/page': 'WebPage'
    };

    if (doc.type && typeMap[doc.type]) {
      return typeMap[doc.type];
    }

    if (doc.type && typeof doc.type === 'string') {
      return doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
    }

    return 'Thing';
  }

  getBreadcrumbListSchema(data) {
    const { page, piece } = data;
    const baseUrl = this.getBaseUrl(data);

    // Only generate breadcrumbs for pages, not pieces
    if (!page || piece || !page._url) {
      return null;
    }

    // Get ancestors (parent pages)
    const ancestors = page._ancestors || [];

    // Build breadcrumb items array
    const items = [];

    // Add ancestors first
    ancestors.forEach((ancestor, index) => {
      if (ancestor._url && ancestor.title) {
        items.push({
          '@type': 'ListItem',
          position: index + 1,
          name: ancestor.title,
          item: this.ensureAbsoluteUrl(ancestor._url, baseUrl)
        });
      }
    });

    // Add current page as last item
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: page.title,
      item: this.ensureAbsoluteUrl(page._url, baseUrl)
    });

    // Only return breadcrumbs if we have more than just the home page
    if (items.length <= 1) {
      return null;
    }

    return {
      '@type': 'BreadcrumbList',
      '@id': baseUrl ? this.ensureAbsoluteUrl(page._url, baseUrl) + '#breadcrumb' : undefined,
      itemListElement: items
    };
  }

  getQAPageSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const qa = document?.seoJsonLdQAPage;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !qa || !qa.question?.trim()) {
      return null;
    }

    const questionSchema = {
      '@type': 'Question',
      name: qa.question
    };

    // Question text/body
    if (qa.questionText?.trim()) {
      questionSchema.text = qa.questionText;
    }

    // Question author
    if (qa.questionAuthor?.trim()) {
      questionSchema.author = {
        '@type': 'Person',
        name: qa.questionAuthor
      };
    }

    // Question date
    if (qa.questionDate) {
      questionSchema.dateCreated = qa.questionDate;
    }

    // Question upvotes
    if (qa.questionUpvotes !== undefined && qa.questionUpvotes !== null) {
      questionSchema.upvoteCount = qa.questionUpvotes;
    }

    // Accepted answer
    if (qa.acceptedAnswer?.text?.trim()) {
      questionSchema.acceptedAnswer = {
        '@type': 'Answer',
        text: qa.acceptedAnswer.text
      };

      if (qa.acceptedAnswer.author?.trim()) {
        questionSchema.acceptedAnswer.author = {
          '@type': 'Person',
          name: qa.acceptedAnswer.author
        };
      }

      if (qa.acceptedAnswer.dateCreated) {
        questionSchema.acceptedAnswer.dateCreated = qa.acceptedAnswer.dateCreated;
      }

      if (qa.acceptedAnswer.upvotes !== undefined && qa.acceptedAnswer.upvotes !== null) {
        questionSchema.acceptedAnswer.upvoteCount = qa.acceptedAnswer.upvotes;
      }
    }

    // Suggested answers
    if (qa.suggestedAnswers?.length) {
      const validAnswers = qa.suggestedAnswers
        .filter(a => a.text?.trim())
        .map(answer => {
          const answerSchema = {
            '@type': 'Answer',
            text: answer.text
          };

          if (answer.author?.trim()) {
            answerSchema.author = {
              '@type': 'Person',
              name: answer.author
            };
          }

          if (answer.dateCreated) {
            answerSchema.dateCreated = answer.dateCreated;
          }

          if (answer.upvotes !== undefined && answer.upvotes !== null) {
            answerSchema.upvoteCount = answer.upvotes;
          }

          return answerSchema;
        });

      if (validAnswers.length > 0) {
        questionSchema.suggestedAnswer = validAnswers;
      }
    }

    const schema = {
      '@type': 'QAPage',
      mainEntity: questionSchema
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#qapage`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#qapage`;
      schema.url = absoluteUrl;
    }

    return schema;
  }

  getVideoSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const video = document?.seoJsonLdVideo;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !video || !video.name?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'VideoObject',
      name: video.name
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#video`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#video`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(video, document);
    if (description) {
      schema.description = description;
    }

    if (video.uploadDate) {
      schema.uploadDate = video.uploadDate;
    }

    if (video.duration?.trim()) {
      schema.duration = video.duration;
    }

    // Thumbnail - REQUIRED by Google
    const thumbnail =
      getImageData(video._thumbnail) ||
      getImageData(document._featuredImage);
    if (thumbnail) {
      schema.thumbnailUrl = thumbnail.url;
    } else {
      // Log warning in debug mode
      this.logDebug('Video schema missing required thumbnailUrl:', document._url || document.slug);
    }

    // Upload date - REQUIRED by Google
    if (video.uploadDate) {
      schema.uploadDate = video.uploadDate;
    } else if (document.publishedAt || document.createdAt) {
      // Fallback to document dates
      schema.uploadDate = document.publishedAt || document.createdAt;
    } else {
      this.logDebug('Video schema missing required uploadDate:', document._url || document.slug);
    }

    // At least one URL required
    if (!video.contentUrl?.trim() && !video.embedUrl?.trim()) {
      this.logDebug('Video schema missing contentUrl or embedUrl:', document._url || document.slug);
    }

    // Video URL or embed URL
    if (video.contentUrl?.trim()) {
      schema.contentUrl = video.contentUrl;
    }

    if (video.embedUrl?.trim()) {
      schema.embedUrl = video.embedUrl;
    }

    // NEW: Learning video properties
    if (video.isEducational) {
      if (video.educationalUse?.trim()) {
        schema.educationalUse = video.educationalUse;
      }
      if (video.learningResourceType?.trim()) {
        schema.learningResourceType = video.learningResourceType;
      }
    }

    return schema;
  }

  getHowToSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const howTo = document?.seoJsonLdHowTo;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !howTo || !howTo.name?.trim() || !howTo.steps?.length) {
      return null;
    }

    const schema = {
      '@type': 'HowTo',
      name: howTo.name
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#howto`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#howto`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(howTo, document);
    if (description) {
      schema.description = description;
    }

    // Add image if available
    const howToImage = this.getImageDataWithFallbacks(howTo, document);
    if (howToImage) {
      schema.image = howToImage.url;
    }

    // Total time
    if (howTo.totalTime?.trim()) {
      schema.totalTime = howTo.totalTime;
    }

    // Supply list
    if (howTo.supply?.length) {
      const validSupplies = howTo.supply
        .filter(s => s.name?.trim())
        .map(s => ({
          '@type': 'HowToSupply',
          name: s.name
        }));

      if (validSupplies.length > 0) {
        schema.supply = validSupplies;
      }
    }

    // Tool list
    if (howTo.tool?.length) {
      const validTools = howTo.tool
        .filter(t => t.name?.trim())
        .map(t => ({
          '@type': 'HowToTool',
          name: t.name
        }));

      if (validTools.length > 0) {
        schema.tool = validTools;
      }
    }

    // Steps
    const validSteps = howTo.steps
      .filter(s => s.name?.trim() && s.text?.trim())
      .map((step, i) => {
        const stepSchema = {
          '@type': 'HowToStep',
          position: i + 1,
          name: step.name,
          text: step.text
        };

        if (step.url?.trim()) {
          stepSchema.url = step.url;
        }

        const stepImage = getImageData(step._image);
        if (stepImage) {
          stepSchema.image = stepImage.url;
        }

        return stepSchema;
      });

    if (validSteps.length > 0) {
      schema.step = validSteps;
    }

    return schema;
  }

  getReviewSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const review = document?.seoJsonLdReview;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !review || !review.itemReviewed?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'Review',
      itemReviewed: {
        '@type': review.itemType || 'Thing',
        name: review.itemReviewed
      }
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#review`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#review`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(review, document);
    if (description) {
      schema.reviewBody = description;
    }

    // Rating
    if (review.reviewRating) {
      schema.reviewRating = {
        '@type': 'Rating',
        ratingValue: review.reviewRating.toString(),
        bestRating: '5',
        worstRating: '1'
      };
    }

    // Author
    const authorName = this.getAuthorName(review, document, data.req);
    if (authorName) {
      schema.author = {
        '@type': 'Person',
        name: authorName
      };
    }

    // Date published
    const datePublished = this.getDateWithFallbacks(review, document, 'published');
    if (datePublished) {
      schema.datePublished = datePublished;
    }

    return schema;
  }

  getRecipeSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const recipe = document?.seoJsonLdRecipe;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !recipe || !recipe.name?.trim()) {
      return null;
    }

    // Image is REQUIRED by Google - check before proceeding
    const recipeImage = this.getImageDataWithFallbacks(recipe, document);
    if (!recipeImage) {
      this.logDebug('Recipe schema requires an image. Skipping schema generation.');
      return null;
    }

    const schema = {
      '@type': 'Recipe',
      name: recipe.name,
      image: recipeImage.url
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#recipe`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#recipe`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(recipe, document);
    if (description) {
      schema.description = description;
    }

    // Author
    const authorName = this.getAuthorName(recipe, document, data.req);
    if (authorName) {
      schema.author = {
        '@type': 'Person',
        name: authorName
      };
    }

    // Dates
    const datePublished = this.getDateWithFallbacks(recipe, document, 'published');
    if (datePublished) {
      schema.datePublished = datePublished;
    }

    // Times
    if (recipe.prepTime?.trim()) {
      schema.prepTime = recipe.prepTime;
    }

    if (recipe.cookTime?.trim()) {
      schema.cookTime = recipe.cookTime;
    }

    if (recipe.totalTime?.trim()) {
      schema.totalTime = recipe.totalTime;
    }

    // Yield
    if (recipe.recipeYield?.trim()) {
      schema.recipeYield = recipe.recipeYield;
    }

    // Category and cuisine
    if (recipe.recipeCategory?.trim()) {
      schema.recipeCategory = recipe.recipeCategory;
    }

    if (recipe.recipeCuisine?.trim()) {
      schema.recipeCuisine = recipe.recipeCuisine;
    }

    // Ingredients
    if (recipe.recipeIngredient?.length) {
      const validIngredients = recipe.recipeIngredient
        .filter(i => i.ingredient?.trim())
        .map(i => i.ingredient);

      if (validIngredients.length > 0) {
        schema.recipeIngredient = validIngredients;
      }
    }

    // Instructions - Google prefers HowToStep array format
    if (recipe.recipeInstructions?.length) {
      const validInstructions = recipe.recipeInstructions
        .filter(i => i.instruction?.trim())
        .map((instr, idx) => ({
          '@type': 'HowToStep',
          position: idx + 1,
          text: instr.instruction,
          name: `Step ${idx + 1}`
        }));

      if (validInstructions.length > 0) {
        schema.recipeInstructions = validInstructions;
      }
    }

    // Video (optional but recommended by Google)
    if (recipe.video?.trim()) {
      schema.video = {
        '@type': 'VideoObject',
        name: recipe.name,
        description: recipe.description || document.seoDescription || recipe.name,
        contentUrl: recipe.video,
        thumbnailUrl: recipeImage.url
      };
    }

    // Keywords (optional but helps with categorization)
    if (recipe.keywords?.trim()) {
      schema.keywords = recipe.keywords;
    }

    // Nutrition (if provided)
    if (recipe.nutrition) {
      const nutrition = {};
      let hasNutritionData = false;

      if (recipe.nutrition.calories?.trim()) {
        nutrition.calories = recipe.nutrition.calories;
        hasNutritionData = true;
      }
      if (recipe.nutrition.carbohydrateContent?.trim()) {
        nutrition.carbohydrateContent = recipe.nutrition.carbohydrateContent;
        hasNutritionData = true;
      }
      if (recipe.nutrition.proteinContent?.trim()) {
        nutrition.proteinContent = recipe.nutrition.proteinContent;
        hasNutritionData = true;
      }
      if (recipe.nutrition.fatContent?.trim()) {
        nutrition.fatContent = recipe.nutrition.fatContent;
        hasNutritionData = true;
      }

      if (hasNutritionData) {
        schema.nutrition = {
          '@type': 'NutritionInformation',
          ...nutrition
        };
      }
    }

    // Aggregate rating
    if (recipe.rating && recipe.reviewCount) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: recipe.rating.toString(),
        reviewCount: recipe.reviewCount.toString(),
        bestRating: '5',
        worstRating: '1'
      };
    }

    return schema;
  }

  getCourseSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const course = document?.seoJsonLdCourse;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !course || !course.name?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'Course',
      name: course.name
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#course`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#course`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(course, document);
    if (description) {
      schema.description = description;
    }

    // Provider
    const global = data.global;
    if (course.provider?.trim() || global?.seoJsonLdOrganization?.name) {
      schema.provider = {
        '@type': 'Organization',
        name: course.provider || global.seoJsonLdOrganization.name
      };

      const baseUrl = this.getBaseUrl(data);
      if (baseUrl) {
        schema.provider['@id'] = `${baseUrl}/#org`;
      }
    }

    // Course code
    if (course.courseCode?.trim()) {
      schema.courseCode = course.courseCode;
    }

    // Educational level
    if (course.educationalLevel?.trim()) {
      schema.educationalLevel = course.educationalLevel;
    }

    // Offers (pricing)
    if (course.price !== undefined && course.price !== null) {
      schema.offers = {
        '@type': 'Offer',
        price: course.price.toString(),
        priceCurrency: course.currency || 'USD'
      };

      if (course.availability) {
        schema.offers.availability = `https://schema.org/${course.availability}`;
      }
    }

    // Aggregate rating
    if (course.rating && course.reviewCount) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: course.rating.toString(),
        reviewCount: course.reviewCount.toString(),
        bestRating: '5',
        worstRating: '1'
      };
    }

    return schema;
  }

  getJobPostingSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const job = document?.seoJsonLdJobPosting;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !job || !job.title?.trim()) {
      return null;
    }

    const schema = {
      '@type': 'JobPosting',
      title: job.title
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#jobposting`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#jobposting`;
      schema.url = absoluteUrl;
    }

    // Description - required by Google
    const description = this.getDescriptionWithFallbacks(job, document);
    if (description) {
      schema.description = description;
    }

    // Date posted - required by Google
    if (job.datePosted || document.publishedAt || document.createdAt) {
      schema.datePosted = job.datePosted || document.publishedAt || document.createdAt;
    }

    // Valid through (expiration date) - required by Google
    if (job.validThrough) {
      schema.validThrough = job.validThrough;
    }

    // Employment type
    if (job.employmentType?.length) {
      schema.employmentType = job.employmentType;
    }

    // Hiring Organization - required by Google
    const global = data.global;
    if (job.hiringOrganization?.name?.trim()) {
      schema.hiringOrganization = {
        '@type': 'Organization',
        name: job.hiringOrganization.name
      };

      if (job.hiringOrganization.sameAs?.trim()) {
        schema.hiringOrganization.sameAs = job.hiringOrganization.sameAs;
      }

      // Logo
      const orgLogo = getImageData(job.hiringOrganization._logo) ||
        getImageData(global?.seoJsonLdOrganization?._logo);
      if (orgLogo) {
        schema.hiringOrganization.logo = orgLogo.url;
      }
    } else if (global?.seoJsonLdOrganization?.name) {
      // Fall back to global org
      schema.hiringOrganization = {
        '@type': 'Organization',
        name: global.seoJsonLdOrganization.name
      };

      const baseUrl = this.getBaseUrl(data);
      if (baseUrl) {
        schema.hiringOrganization['@id'] = `${baseUrl}/#org`;
      }

      const orgLogo = getImageData(global.seoJsonLdOrganization._logo);
      if (orgLogo) {
        schema.hiringOrganization.logo = orgLogo.url;
      }
    }

    // Job Location - required by Google
    if (job.jobLocation) {
      const loc = job.jobLocation;

      if (loc.remote === true) {
        // Remote job
        schema.jobLocationType = 'TELECOMMUTE';

        // If applicant location requirements are specified
        if (loc.applicantLocationRequirements?.length) {
          schema.applicantLocationRequirements =
            loc.applicantLocationRequirements.map(req => ({
              '@type': 'Country',
              name: req.country
            }));
        }
      }

      if (loc.address?.city?.trim() || loc.address?.street?.trim()) {
        // Physical location
        schema.jobLocation = {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress'
          }
        };

        if (loc.address.street?.trim()) {
          schema.jobLocation.address.streetAddress = loc.address.street;
        }
        if (loc.address.city?.trim()) {
          schema.jobLocation.address.addressLocality = loc.address.city;
        }
        if (loc.address.state?.trim()) {
          schema.jobLocation.address.addressRegion = loc.address.state;
        }
        if (loc.address.zip?.trim()) {
          schema.jobLocation.address.postalCode = loc.address.zip;
        }
        if (loc.address.country?.trim()) {
          schema.jobLocation.address.addressCountry = loc.address.country;
        }
      }
    }

    // Base Salary
    if (job.baseSalary) {
      const salary = job.baseSalary;

      if (salary.minValue || salary.maxValue || salary.value) {
        schema.baseSalary = {
          '@type': 'MonetaryAmount',
          currency: salary.currency || 'USD'
        };

        // Handle salary range vs. fixed salary
        if (salary.minValue && salary.maxValue) {
          schema.baseSalary.value = {
            '@type': 'QuantitativeValue',
            minValue: salary.minValue,
            maxValue: salary.maxValue,
            unitText: salary.unitText || 'YEAR'
          };
        } else if (salary.value) {
          schema.baseSalary.value = {
            '@type': 'QuantitativeValue',
            value: salary.value,
            unitText: salary.unitText || 'YEAR'
          };
        }
      }
    }

    // Experience Requirements
    if (job.experienceRequirements?.trim()) {
      schema.experienceRequirements = {
        '@type': 'OccupationalExperienceRequirements',
        monthsOfExperience: parseInt(job.experienceRequirements, 10)
      };
    }

    // Education Requirements
    if (job.educationRequirements?.trim()) {
      schema.educationRequirements = {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: job.educationRequirements
      };
    }

    // Qualifications
    if (job.qualifications?.trim()) {
      schema.qualifications = job.qualifications;
    }

    // Responsibilities
    if (job.responsibilities?.trim()) {
      schema.responsibilities = job.responsibilities;
    }

    // Skills
    if (job.skills?.length) {
      const validSkills = job.skills
        .filter(s => s.skill?.trim())
        .map(s => s.skill);

      if (validSkills.length > 0) {
        schema.skills = validSkills.join(', ');
      }
    }

    // Benefits
    if (job.jobBenefits?.trim()) {
      schema.jobBenefits = job.jobBenefits;
    }

    // Industry
    if (job.industry?.trim()) {
      schema.industry = job.industry;
    }

    // Occupational Category (ONET code or job category)
    if (job.occupationalCategory?.trim()) {
      schema.occupationalCategory = job.occupationalCategory;
    }

    // Work Hours
    if (job.workHours?.trim()) {
      schema.workHours = job.workHours;
    }

    // Direct Apply
    if (job.directApply === true && document._url) {
      schema.directApply = true;
    }

    return schema;
  }

  getFAQPageSchema(data) {
    const { piece, page } = data;
    const document = piece || page;
    const faq = document?.seoJsonLdFAQ;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !faq || !faq.questions?.length) {
      return null;
    }

    const schema = {
      '@type': 'FAQPage'
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      schema['@id'] = `${document._url}#faq`;
      schema.url = document._url;
    } else if (baseUrl && document.slug) {
      schema['@id'] = `${baseUrl}${document.slug}#faq`;
    }

    if (baseUrl) {
      schema.isPartOf = { '@id': `${baseUrl}/#website` };
    }

    // Build mainEntity array of Questions
    const validQuestions = faq.questions
      .filter(q => q.question?.trim() && q.answer?.trim())
      .map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer
        }
      }));

    if (validQuestions.length > 0) {
      schema.mainEntity = validQuestions;
    } else {
      return null; // No valid Q&A pairs
    }

    return schema;
  }

  getOfferSchema(data) {
    const {
      piece,
      page,
      global
    } = data;
    const document = piece || page;
    const offer = document?.seoJsonLdOffer;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !offer || !offer.name?.trim() || !offer.price) {
      return null;
    }

    const schema = {
      '@type': 'Offer',
      name: offer.name,
      price: offer.price.toString(),
      priceCurrency: offer.priceCurrency || 'USD'
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#offer`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#offer`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(offer, document);
    if (description) {
      schema.description = description;
    }

    // Availability
    if (offer.availability) {
      schema.availability = `https://schema.org/${offer.availability}`;
    }

    // Valid dates
    if (offer.validFrom) {
      schema.validFrom = offer.validFrom;
    }

    if (offer.priceValidUntil) {
      schema.priceValidUntil = offer.priceValidUntil;
    }

    // Item condition
    if (offer.itemCondition) {
      schema.itemCondition = `https://schema.org/${offer.itemCondition}`;
    }

    // Seller - use offer seller, fallback to organization
    if (offer.seller?.trim()) {
      schema.seller = {
        '@type': 'Organization',
        name: offer.seller
      };
    } else if (global?.seoJsonLdOrganization?.name) {
      const baseUrl = this.getBaseUrl(data);
      schema.seller = {
        '@type': 'Organization',
        name: global.seoJsonLdOrganization.name
      };
      if (baseUrl) {
        schema.seller['@id'] = `${baseUrl}/#org`;
      }
    }

    // Shipping details
    if (offer.shippingDetails?.shippingRate !== undefined) {
      schema.shippingDetails = {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: offer.shippingDetails.shippingRate.toString(),
          currency: offer.priceCurrency || 'USD'
        }
      };

      if (offer.shippingDetails.shippingDestination?.trim()) {
        schema.shippingDetails.shippingDestination = {
          '@type': 'DefinedRegion',
          addressCountry: offer.shippingDetails.shippingDestination
        };
      }

      if (offer.shippingDetails.deliveryTime?.trim()) {
        schema.shippingDetails.deliveryTime = {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            value: offer.shippingDetails.deliveryTime
          }
        };
      }
    }

    return schema;
  }

  getAggregateOfferSchema(data) {
    const {
      piece,
      page,
      global
    } = data;
    const document = piece || page;
    const aggregateOffer = document?.seoJsonLdAggregateOffer;
    const baseUrl = this.getBaseUrl(data);

    if (!document || !aggregateOffer || !aggregateOffer.name?.trim() ||
      !aggregateOffer.lowPrice || !aggregateOffer.highPrice) {
      return null;
    }

    const schema = {
      '@type': 'AggregateOffer',
      name: aggregateOffer.name,
      lowPrice: aggregateOffer.lowPrice.toString(),
      highPrice: aggregateOffer.highPrice.toString(),
      priceCurrency: aggregateOffer.priceCurrency || 'USD'
    };

    // Only add @id if we have a complete URL
    if (document._url) {
      const absoluteUrl = this.ensureAbsoluteUrl(document._url, baseUrl);
      schema['@id'] = `${absoluteUrl}#aggregateoffer`;
      schema.url = absoluteUrl;
    } else if (baseUrl && document.slug) {
      // Fallback: construct URL from baseUrl + slug
      const absoluteUrl = `${baseUrl}/${document.slug}`;
      schema['@id'] = `${absoluteUrl}#aggregateoffer`;
      schema.url = absoluteUrl;
    }

    const description = this.getDescriptionWithFallbacks(aggregateOffer, document);
    if (description) {
      schema.description = description;
    }

    // Offer count
    if (aggregateOffer.offerCount) {
      schema.offerCount = aggregateOffer.offerCount;
    }

    // Availability
    if (aggregateOffer.availability) {
      schema.availability = `https://schema.org/${aggregateOffer.availability}`;
    }

    // Seller
    if (aggregateOffer.seller?.trim()) {
      schema.seller = {
        '@type': 'Organization',
        name: aggregateOffer.seller
      };
    } else if (global?.seoJsonLdOrganization?.name) {
      const baseUrl = this.getBaseUrl(data);
      schema.seller = {
        '@type': 'Organization',
        name: global.seoJsonLdOrganization.name
      };
      if (baseUrl) {
        schema.seller['@id'] = `${baseUrl}/#org`;
      }
    }

    // Individual offers array
    if (aggregateOffer.offers?.length) {
      const validOffers = aggregateOffer.offers
        .filter(o => o.name?.trim() && o.price)
        .map(o => {
          const offerSchema = {
            '@type': 'Offer',
            name: o.name,
            price: o.price.toString(),
            priceCurrency: o.priceCurrency || aggregateOffer.priceCurrency || 'USD'
          };

          if (o.availability) {
            offerSchema.availability = `https://schema.org/${o.availability}`;
          }

          if (o.url?.trim()) {
            offerSchema.url = o.url;
          }

          return offerSchema;
        });

      if (validOffers.length > 0) {
        schema.offers = validOffers;
      }
    }

    return schema;
  }

  // Schema validation method
  validateSchema(schema) {
    const warnings = [];
    const type = schema['@type'];

    // Article validation
    if (type === 'Article') {
      if (!schema.headline) {
        warnings.push('Article missing headline');
      }
      if (!schema.datePublished) {
        warnings.push('Article missing datePublished');
      }
      if (!schema.author) {
        warnings.push('Article missing author');
      }
      if (!schema.publisher) {
        warnings.push('Article missing publisher');
      }
    }

    // Product validation
    if (type === 'Product') {
      if (!schema.name) {
        warnings.push('Product missing name');
      }
      if (!schema.offers) {
        warnings.push('Product missing offers/price');
      }
      if (schema.offers && !schema.offers.price) {
        warnings.push('Product offer missing price');
      }
    }

    // Event validation
    if (type === 'Event') {
      if (!schema.name) {
        warnings.push('Event missing name');
      }
      if (!schema.startDate) {
        warnings.push('Event missing startDate');
      }
      if (!schema.location) {
        warnings.push('Event missing location');
      }
    }

    // Recipe validation
    if (type === 'Recipe') {
      if (!schema.name) {
        warnings.push('Recipe missing name');
      }
      if (!schema.image) {
        warnings.push('Recipe missing image (required by Google)');
      }
      if (!schema.recipeIngredient || schema.recipeIngredient.length === 0) {
        warnings.push('Recipe missing ingredients');
      }
      if (!schema.recipeInstructions || schema.recipeInstructions.length === 0) {
        warnings.push('Recipe missing instructions');
      }
    }

    // HowTo validation
    if (type === 'HowTo') {
      if (!schema.name) {
        warnings.push('HowTo missing name');
      }
      if (!schema.step || schema.step.length === 0) {
        warnings.push('HowTo missing steps');
      }
    }

    // Course validation
    if (type === 'Course') {
      if (!schema.name) {
        warnings.push('Course missing name');
      }
      if (!schema.description) {
        warnings.push('Course missing description');
      }
      if (!schema.provider) {
        warnings.push('Course missing provider');
      }
    }

    // JobPosting validation
    if (type === 'JobPosting') {
      if (!schema.title) {
        warnings.push('JobPosting missing title');
      }
      if (!schema.description) {
        warnings.push('JobPosting missing description');
      }
      if (!schema.datePosted) {
        warnings.push('JobPosting missing datePosted');
      }
      if (!schema.hiringOrganization) {
        warnings.push('JobPosting missing hiringOrganization');
      }
      if (!schema.jobLocation && !schema.jobLocationType) {
        warnings.push('JobPosting missing jobLocation (use physical location or set as remote)');
      }
    }

    if (type === 'QAPage') {
      if (!schema.mainEntity) {
        warnings.push('QAPage missing mainEntity (Question)');
      }
      if (schema.mainEntity && !schema.mainEntity.name) {
        warnings.push('Question missing name');
      }
      const hasMainEntity = schema.mainEntity;
      const hasAcceptedAnswer = schema.mainEntity?.acceptedAnswer;
      const hasSuggestedAnswers = schema.mainEntity?.suggestedAnswer?.length > 0;

      if (hasMainEntity && !hasAcceptedAnswer && !hasSuggestedAnswers) {
        warnings.push('QAPage should have at least one answer (accepted or suggested)');
      }
    }

    // Offer validation
    if (type === 'Offer') {
      if (!schema.name) {
        warnings.push('Offer missing name');
      }
      if (!schema.price) {
        warnings.push('Offer missing price');
      }
      if (!schema.priceCurrency) {
        warnings.push('Offer missing priceCurrency');
      }
      if (!schema.availability) {
        warnings.push('Offer should specify availability');
      }
    }

    // AggregateOffer validation
    if (type === 'AggregateOffer') {
      if (!schema.name) {
        warnings.push('AggregateOffer missing name');
      }
      if (!schema.lowPrice) {
        warnings.push('AggregateOffer missing lowPrice');
      }
      if (!schema.highPrice) {
        warnings.push('AggregateOffer missing highPrice');
      }
      if (!schema.priceCurrency) {
        warnings.push('AggregateOffer missing priceCurrency');
      }
      if (parseFloat(schema.lowPrice) > parseFloat(schema.highPrice)) {
        warnings.push('AggregateOffer lowPrice should be less than or equal to highPrice');
      }
    }

    // Video validation
    if (type === 'VideoObject') {
      if (!schema.name) {
        warnings.push('Video missing name');
      }
      if (!schema.thumbnailUrl) {
        warnings.push('Video missing required thumbnailUrl');
      }
      if (!schema.uploadDate) {
        warnings.push('Video missing required uploadDate');
      }
      if (!schema.contentUrl && !schema.embedUrl) {
        warnings.push('Video missing contentUrl or embedUrl (at least one required)');
      }
    }

    // Log warnings if debug mode is enabled
    if (warnings.length) {
      this.logDebug(`Schema validation warnings for ${type}:`, warnings);
    }

    return warnings.length === 0;
  }
}

module.exports = JsonLdSchemaHandler;

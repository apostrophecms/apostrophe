const JsonLdSchemaHandler = require('./jsonld-schemas');

function getMetaHead(data, options) {
  const nodes = [];
  const home = data.home;
  const piece = data.piece;
  const page = data.page;
  const global = data.global;
  const document = piece || page;

  // Theme color for mobile browsers
  if (global?.seoThemeColor) {
    const themeColorConfig = global.seoThemeColor;

    if (themeColorConfig.mode === 'lightDark') {
      // Light and dark mode support
      if (themeColorConfig.light) {
        nodes.push({
          name: 'meta',
          attrs: {
            name: 'theme-color',
            content: themeColorConfig.light,
            media: '(prefers-color-scheme: light)'
          }
        });
      }

      if (themeColorConfig.dark) {
        nodes.push({
          name: 'meta',
          attrs: {
            name: 'theme-color',
            content: themeColorConfig.dark,
            media: '(prefers-color-scheme: dark)'
          }
        });
      }
    } else if (themeColorConfig.single) {
      // Single color mode
      nodes.push({
        name: 'meta',
        attrs: {
          name: 'theme-color',
          content: themeColorConfig.single
        }
      });
    }
  }

  // title
  // NOTE: This uses <meta name="title"> instead of <title> to avoid conflicts.
  // ApostropheCMS core templates typically provide their own <title> tag via
  // template blocks. Using <meta name="title"> here is non-standard HTML but
  // allows the SEO title to be set without creating duplicate <title> tags.

  const seoTitle = piece?.seoTitle ||
    page?.seoTitle ||
    home?.seoTitle;
  if (seoTitle) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'title',
        content: seoTitle
      }
    });
  }

  // description
  const seoDescription = piece?.seoDescription ||
    page?.seoDescription ||
    home?.seoDescription;
  if (seoDescription) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'description',
        content: seoDescription
      }
    });
  }

  // robots
  const seoRobots = document?.seoRobots;
  if (seoRobots?.length) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'robots',
        content: seoRobots.join(',')
      }
    });
  }

  // Google Verification ID
  if (global?.seoGoogleVerificationId) {
    nodes.push({
      name: 'meta',
      attrs: {
        name: 'google-site-verification',
        content: global.seoGoogleVerificationId
      }
    });
  }

  // canonical URL logic
  if (document?._seoCanonical?.length) {
    // canonical page URL
    nodes.push({
      name: 'link',
      attrs: {
        rel: 'canonical',
        href: document._seoCanonical[0]._url
      }
    });
  } else if (document?.seoSelectType &&
    document[document.seoSelectType]?.length) {
    // canonical piece-page URL
    nodes.push({
      name: 'link',
      attrs: {
        rel: 'canonical',
        href: document[document.seoSelectType][0]._url
      }
    });
  }

  // Pagination support for listing pages and piece navigation
  if (data.pagination) {
    const {
      currentPage,
      totalPages,
      baseUrl
    } = data.pagination;

    // Previous page link
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      const prevUrl = prevPage === 1 ? baseUrl : `${baseUrl}?page=${prevPage}`;
      nodes.push({
        name: 'link',
        attrs: {
          rel: 'prev',
          href: prevUrl
        }
      });
    }

    // Next page link
    if (currentPage < totalPages) {
      nodes.push({
        name: 'link',
        attrs: {
          rel: 'next',
          href: `${baseUrl}?page=${currentPage + 1}`
        }
      });
    }
  } else if (data.currentPage && data.totalPages && data.page?._url) {
    const currentPage = data.currentPage;
    const totalPages = data.totalPages;
    const baseUrl = data.page._url;

    // Previous page link
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      // Page 1 should have clean URL (no query string)
      const prevUrl = prevPage === 1 ? baseUrl : `${baseUrl}?page=${prevPage}`;
      nodes.push({
        name: 'link',
        attrs: {
          rel: 'prev',
          href: prevUrl
        }
      });
    }

    // Next page link
    if (currentPage < totalPages) {
      nodes.push({
        name: 'link',
        attrs: {
          rel: 'next',
          href: `${baseUrl}?page=${currentPage + 1}`
        }
      });
    }
  } else if (data.next || data.previous) {
    // Previous piece link
    if (data.previous?._url) {
      nodes.push({
        name: 'link',
        attrs: {
          rel: 'prev',
          href: data.previous._url
        }
      });
    }

    // Next piece link
    if (data.next?._url) {
      nodes.push({
        name: 'link',
        attrs: {
          rel: 'next',
          href: data.next._url
        }
      });
    }
  }

  // Preload critical fonts
  if (options.criticalFonts?.length) {
    options.criticalFonts.forEach(font => {
      const attrs = {
        rel: 'preload',
        href: font.url,
        as: 'font',
        type: font.type || 'font/woff2'
      };

      // Add crossorigin for absolute URLs (likely cross-origin)
      if (font.url.startsWith('http')) {
        attrs.crossorigin = font.crossorigin || 'anonymous';
      }

      nodes.push({
        name: 'link',
        attrs
      });
    });
  }

  // Google Tracking ID
  if (global?.seoGoogleTrackingId) {
    nodes.push({
      comment: 'Global site tag (gtag.js) - Google Analytics'
    });
    nodes.push({
      name: 'script',
      attrs: {
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${global.seoGoogleTrackingId}`
      }
    });
    nodes.push({
      name: 'script',
      body: [ {
        raw: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${global.seoGoogleTrackingId}');
`
      } ]
    });
  }

  // JSON-LD Structured Data with error handling
  if (shouldGenerateJsonLd(data)) {
    try {
      const seoModule = options.apos?.modules?.['@apostrophecms/seo'];
      const customSchemas = seoModule?.getCustomSchemas?.() || {};

      const seoFieldMappings = seoModule?.options?.seoFieldMappings || {};
      const jsonLdHandler = new JsonLdSchemaHandler(customSchemas, seoFieldMappings);
      const schemas = jsonLdHandler.generateSchemas(data);

      if (schemas.length > 0) {
        const jsonLdData = {
          '@context': 'https://schema.org',
          '@graph': schemas
        };

        const jsonLdString = JSON.stringify(jsonLdData, null, 2);

        nodes.push({
          comment: ' JSON-LD Structured Data '
        });

        const scriptNode = {
          name: 'script',
          attrs: { type: 'application/ld+json' },
          body: [ {
            raw: jsonLdString
          } ]
        };

        nodes.push(scriptNode);
      }
    } catch (err) {
      if (process.env.APOS_SEO_DEBUG) {
        console.error('[SEO] Error generating JSON-LD:', err);
        console.error('[SEO] Data that caused error:', JSON.stringify(data, null, 2));
      }
    }
  }

  // Add hreflang tags
  const hreflangTags = getHreflangTags(data);
  nodes.push(...hreflangTags);

  return nodes;
}

function getHreflangTags(data) {
  const nodes = [];
  const {
    piece, page, req
  } = data;
  const document = piece || page;

  // Only add hreflang if the site has i18n enabled
  if (!req?.locale || !document?._url) {
    return nodes;
  }

  // Get all locale versions of this document if they exist
  // This assumes ApostropheCMS i18n structure
  if (document.aposLocale && data.alternateLocales) {
    // Add current page
    nodes.push({
      name: 'link',
      attrs: {
        rel: 'alternate',
        hreflang: req.locale,
        href: document._url
      }
    });

    // Add alternate locales
    data.alternateLocales.forEach(alt => {
      if (alt.locale && alt.url) {
        nodes.push({
          name: 'link',
          attrs: {
            rel: 'alternate',
            hreflang: alt.locale,
            href: alt.url
          }
        });
      }
    });

    // Add x-default for the primary locale
    const defaultLocale = data.alternateLocales.find(alt => alt.isDefault);
    if (defaultLocale) {
      nodes.push({
        name: 'link',
        attrs: {
          rel: 'alternate',
          hreflang: 'x-default',
          href: defaultLocale.url
        }
      });
    }
  }

  return nodes;
}

// Helper function to determine if we should generate JSON-LD
function shouldGenerateJsonLd(data) {
  const {
    global, piece, page, home
  } = data;

  const hasOrgData = global?.seoJsonLdOrganization?.name;

  const hasSiteData = global?.seoSiteName || global?.title;

  const document = piece || page;
  const hasDocumentSchema = document?.seoJsonLdType;

  const isHomepage = home || (!piece && page?.slug === '/');

  return hasOrgData || hasSiteData || hasDocumentSchema || isHomepage;
}

function getTagManagerHead(data) {
  const nodes = [];
  const global = data.global;

  if (global?.seoGoogleTagManager) {
    nodes.push({
      comment: ' Google Tag Manager '
    });

    nodes.push({
      name: 'script',
      body: [ {
        raw: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${global.seoGoogleTagManager}');`
      } ]
    });

    nodes.push({
      comment: ' End Google Tag Manager '
    });
  }

  return nodes;
}

function getTagManagerBody(data) {
  const nodes = [];
  const global = data.global;

  if (global && global.seoGoogleTagManager) {
    // Comment node for Google Tag Manager (noscript) start
    nodes.push({
      comment: ' Google Tag Manager (noscript) '
    });

    // Noscript tag with iframe
    nodes.push({
      name: 'noscript',
      body: [ {
        name: 'iframe',
        attrs: {
          src: `https://www.googletagmanager.com/ns.html?id=${global.seoGoogleTagManager}`,
          height: '0',
          width: '0',
          style: 'display:none;visibility:hidden'
        }
      } ]
    });

    // Comment node for Google Tag Manager (noscript) end
    nodes.push({
      comment: ' End Google Tag Manager (noscript) '
    });
  }

  return nodes;
}

module.exports = {
  getMetaHead,
  getTagManagerHead,
  getTagManagerBody,
  getHreflangTags
};

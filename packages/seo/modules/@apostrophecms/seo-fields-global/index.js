module.exports = {
  improve: '@apostrophecms/global',
  options: {
    seoFields: false
  },
  fields(self, options) {
    const add = {
      robotsTxtSelection: {
        label: 'aposSeo:robotsTxtSelection',
        type: 'select',
        def: 'allow',
        help: 'aposSeo:robotsTxtSelectionHelp',
        choices: [
          {
            label: 'aposSeo:robotsTxtAllowAll',
            value: 'allow'
          },
          {
            label: 'aposSeo:robotsTxtAllowSearchBlockAI',
            value: 'allowSearchBlockAI'
          },
          {
            label: 'aposSeo:robotsTxtSelective',
            value: 'selective'
          },
          {
            label: 'aposSeo:robotsTxtDisallow',
            value: 'disallow'
          },
          {
            label: 'aposSeo:robotsTxtCustom',
            value: 'custom'
          }
        ]
      },
      robotsAISelective: {
        label: 'aposSeo:robotsAISelectiveLabel',
        type: 'checkboxes',
        help: 'aposSeo:robotsAISelectiveHelp',
        if: {
          robotsTxtSelection: 'selective'
        },
        choices: [
          {
            label: 'aposSeo:crawlerGPTBot',
            value: 'GPTBot'
          },
          {
            label: 'aposSeo:crawlerChatGPTUser',
            value: 'ChatGPT-User'
          },
          {
            label: 'aposSeo:crawlerGoogleExtended',
            value: 'Google-Extended'
          },
          {
            label: 'aposSeo:crawlerClaudeBot',
            value: 'ClaudeBot'
          },
          {
            label: 'aposSeo:crawlerClaudeUser',
            value: 'Claude-User'
          },
          {
            label: 'aposSeo:crawlerPerplexityBot',
            value: 'PerplexityBot'
          },
          {
            label: 'aposSeo:crawlerCCBot',
            value: 'CCBot'
          },
          {
            label: 'aposSeo:crawlerAnthropicAI',
            value: 'anthropic-ai'
          },
          {
            label: 'aposSeo:crawlerApplebotExtended',
            value: 'Applebot-Extended'
          },
          {
            label: 'aposSeo:crawlerFacebookBot',
            value: 'Meta-WebIndexer'
          }
        ],
        // Default to allowing browsing bots but not training bots
        def: [ 'ChatGPT-User', 'Claude-User', 'PerplexityBot' ]
      },
      robotsCustomText: {
        label: 'aposSeo:robotsCustomText',
        type: 'string',
        textarea: true,
        required: true,
        if: {
          robotsTxtSelection: 'custom'
        }
      },
      // AI/LLM crawler control (llms.txt)
      llmsTxtSelection: {
        label: 'aposSeo:llmsTxtSelection',
        type: 'select',
        def: 'allow',
        help: 'aposSeo:llmsTxtSelectionHelp',
        choices: [
          {
            label: 'aposSeo:llmsTxtAllow',
            value: 'allow'
          },
          {
            label: 'aposSeo:llmsTxtDisallow',
            value: 'disallow'
          },
          {
            label: 'aposSeo:llmsTxtCustom',
            value: 'custom'
          },
          {
            label: 'aposSeo:llmsTxtDisabled',
            value: 'disabled'
          }
        ]
      },
      llmsCustomText: {
        label: 'aposSeo:llmsCustomText',
        type: 'string',
        textarea: true,
        help: 'aposSeo:llmsCustomTextHelp',
        required: true,
        if: {
          llmsTxtSelection: 'custom'
        }
      },
      // JSON-LD Site-wide settings
      seoSiteName: {
        label: 'aposSeo:siteName',
        type: 'string',
        help: 'aposSeo:siteNameHelp'
      },
      seoSiteDescription: {
        label: 'aposSeo:siteDescription',
        type: 'string',
        textarea: true,
        help: 'aposSeo:siteDescriptionHelp'
      },
      seoSiteCanonicalUrl: {
        label: 'aposSeo:siteCanonicalUrl',
        type: 'url',
        required: true,
        help: 'aposSeo:siteCanonicalUrlHelp'
      },
      seoJsonLdOrganization: {
        label: 'aposSeo:organizationInfo',
        type: 'object',
        help: 'aposSeo:organizationInfoHelp',
        fields: {
          add: {
            name: {
              label: 'aposSeo:orgName',
              type: 'string',
              required: true
            },
            type: {
              label: 'aposSeo:orgType',
              type: 'select',
              def: 'Organization',
              choices: [
                {
                  label: 'Organization',
                  value: 'Organization'
                },
                {
                  label: 'Corporation',
                  value: 'Corporation'
                },
                {
                  label: 'LocalBusiness',
                  value: 'LocalBusiness'
                },
                {
                  label: 'NGO',
                  value: 'NGO'
                },
                {
                  label: 'GovernmentOrganization',
                  value: 'GovernmentOrganization'
                }
              ]
            },
            description: {
              label: 'aposSeo:orgDescription',
              type: 'string',
              textarea: true
            },
            _logo: {
              label: 'aposSeo:orgLogo',
              type: 'relationship',
              withType: '@apostrophecms/image',
              max: 1,
              help: 'aposSeo:orgLogoHelp'
            },
            contactPoint: {
              label: 'aposSeo:contactPoint',
              type: 'object',
              fields: {
                add: {
                  telephone: {
                    label: 'aposSeo:telephone',
                    type: 'string'
                  },
                  type: {
                    label: 'aposSeo:contactType',
                    type: 'select',
                    def: 'customer service',
                    choices: [
                      {
                        label: 'Customer Service',
                        value: 'customer service'
                      },
                      {
                        label: 'Sales',
                        value: 'sales'
                      },
                      {
                        label: 'Support',
                        value: 'technical support'
                      },
                      {
                        label: 'Billing',
                        value: 'billing support'
                      }
                    ]
                  }
                }
              }
            },
            address: {
              label: 'aposSeo:address',
              type: 'object',
              fields: {
                add: {
                  street: {
                    label: 'aposSeo:streetAddress',
                    type: 'string'
                  },
                  city: {
                    label: 'aposSeo:city',
                    type: 'string'
                  },
                  state: {
                    label: 'aposSeo:state',
                    type: 'string'
                  },
                  zip: {
                    label: 'aposSeo:postalCode',
                    type: 'string'
                  },
                  country: {
                    label: 'aposSeo:country',
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      },
      seoSocialProfiles: {
        label: 'aposSeo:socialProfiles',
        type: 'array',
        titleField: 'platform',
        help: 'aposSeo:socialProfilesHelp',
        fields: {
          add: {
            platform: {
              label: 'aposSeo:platform',
              type: 'select',
              required: true,
              choices: [
                {
                  label: 'Twitter/X',
                  value: 'twitter'
                },
                {
                  label: 'Bluesky',
                  value: 'bluesky'
                },
                {
                  label: 'LinkedIn',
                  value: 'linkedin'
                },
                {
                  label: 'Facebook',
                  value: 'facebook'
                },
                {
                  label: 'Instagram',
                  value: 'instagram'
                },
                {
                  label: 'YouTube',
                  value: 'youtube'
                },
                {
                  label: 'GitHub',
                  value: 'github'
                }
              ]
            },
            profileUrl: {
              label: 'aposSeo:profileUrl',
              type: 'url',
              required: true,
              help: 'aposSeo:profileUrlHelp'
            }
          }
        }
      },
      seoSearchQueryParam: {
        label: 'aposSeo:searchQueryParam',
        type: 'string',
        def: 'q',
        help: 'aposSeo:searchQueryParamHelp' // "The query parameter your site uses for search (e.g., 'q', 'search', 'query')"
      }
    };

    const group = {
      seo: {
        label: 'aposSeo:group',
        fields: [
          'robotsTxtSelection',
          'robotsAISelective',
          'robotsCustomText',
          'llmsTxtSelection',
          'llmsCustomText',
          'seoSiteName',
          'seoSiteDescription',
          'seoSiteCanonicalUrl',
          'seoJsonLdOrganization',
          'seoSocialProfiles',
          'seoSearchQueryParam'
        ],
        last: true
      }
    };

    if (options.seoGoogleTagManager) {
      add.seoGoogleTagManager = {
        label: 'aposSeo:gtmId',
        type: 'string',
        help: 'aposSeo:gtmIdHelp'
      };
      group.seo.fields.push('seoGoogleTagManager');
    }
    if (options.seoGoogleAnalytics) {
      add.seoGoogleTrackingId = {
        label: 'aposSeo:gaId',
        type: 'string',
        help: 'aposSeo:gaIdHelp'
      };
      group.seo.fields.push('seoGoogleTrackingId');
    }
    if (options.seoGoogleVerification) {
      add.seoGoogleVerificationId = {
        label: 'aposSeo:googleVerifyId',
        type: 'string',
        help: 'aposSeo:googleVerifyIdHelp'
      };
      group.seo.fields.push('seoGoogleVerificationId');
    }

    return Object.keys(add).length
      ? {
        add,
        group
      }
      : null;
  },

  apiRoutes(self) {
    return {
      get: {
        '/robots.txt': async (req) => {
          const criteria = {
            type: '@apostrophecms/global'
          };
          try {
            const globalDoc = await self.apos.doc.find(req, criteria).toObject();
            let robotsTxtContent = '';
            switch (globalDoc.robotsTxtSelection) {
              case 'allow':
                robotsTxtContent = 'User-agent: *\nDisallow: \n';
                break;
              case 'allowSearchBlockAI':
                // Strategic: Allow traditional search, block AI training
                robotsTxtContent = `# Allow traditional search engines
User-agent: Googlebot
Allow: /

User-agent: bingbot
Allow: /

User-agent: Slurp
Allow: /

# Block AI training crawlers
User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Meta-WebIndexer
Disallow: /

# Allow real-time browsing for user queries (not training)
User-agent: ChatGPT-User
Allow: /

User-agent: Claude-User
Allow: /

# Default rule
User-agent: *
Allow: /
`;
                break;
              case 'selective': {
                // Granular control based on checkboxes
                const allowed = globalDoc.robotsAISelective || [];
                const aiCrawlers = [
                  'GPTBot', 'ChatGPT-User', 'Google-Extended',
                  'ClaudeBot', 'Claude-User', 'PerplexityBot',
                  'CCBot', 'anthropic-ai', 'Applebot-Extended', 'Meta-WebIndexer'
                ];
                robotsTxtContent = '# Traditional search engines (always allowed)\n';
                robotsTxtContent += 'User-agent: Googlebot\nAllow: /\n\n';
                robotsTxtContent += 'User-agent: bingbot\nAllow: /\n\n';
                robotsTxtContent += 'User-agent: Slurp\nAllow: /\n\n';
                robotsTxtContent += '# AI Crawlers (selective)\n';
                aiCrawlers.forEach(crawler => {
                  robotsTxtContent += `User-agent: ${crawler}\n`;
                  if (allowed.includes(crawler)) {
                    robotsTxtContent += 'Allow: /\n\n';
                  } else {
                    robotsTxtContent += 'Disallow: /\n\n';
                  }
                });
                robotsTxtContent += '# Default\nUser-agent: *\nAllow: /\n';
                break;
              }
              case 'disallow':
                robotsTxtContent = 'User-agent: *\nDisallow: /\n';
                break;
              case 'custom':
                robotsTxtContent = globalDoc.robotsCustomText || 'User-agent: *\nDisallow: /\n';
                break;
              default:
                robotsTxtContent = 'User-agent: *\nDisallow: \n';
            }

            req.res.setHeader('Content-Type', 'text/plain');
            return robotsTxtContent;
          } catch (err) {
            console.error(err);
            return 'An error occurred generating robots.txt';
          }
        },
        '/llms.txt': async (req) => {
          try {
            const global = await self.apos.doc.find(req, { type: '@apostrophecms/global' }).toObject();

            // Check if llms.txt is disabled
            if (global.llmsTxtSelection === 'disabled') {
              req.res.status(404);
              return 'Not Found';
            }

            // If custom text is provided, use it
            if (global.llmsTxtSelection === 'custom' && global.llmsCustomText) {
              req.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              return global.llmsCustomText;
            }

            const baseUrl = global?.seoSiteCanonicalUrl || req.absoluteUrl.split('/').slice(0, 3).join('/');

            // Build the LLMS.txt content
            let content = `# ${global.seoSiteName || global.title || 'Website'}\n\n`;

            if (global.seoSiteDescription) {
              content += `${global.seoSiteDescription}\n\n`;
            }

            // Add AI training policy based on selection
            if (global.llmsTxtSelection === 'disallow') {
              content += '## AI Training Policy\n\n';
              content += 'This site\'s content should NOT be used for:\n';
              content += '- Training large language models\n';
              content += '- Building AI datasets\n';
              content += '- Machine learning training data\n\n';
              content += 'The content may be used for:\n';
              content += '- Real-time search and retrieval\n';
              content += '- Answering user queries with attribution\n';
              content += '- Providing context with proper citations\n\n';
            } else {
              content += '## AI Training Policy\n\n';
              content += 'This site allows responsible AI crawling and indexing for:\n';
              content += '- Search and retrieval purposes\n';
              content += '- Answering user queries with proper attribution\n';
              content += '- Building context for AI assistants\n\n';
            }

            // Site Information
            content += '## Site Information\n\n';
            content += `- URL: ${baseUrl}\n`;

            if (global.seoJsonLdOrganization?.name) {
              content += `- Organization: ${global.seoJsonLdOrganization.name}\n`;
              content += `- Type: ${global.seoJsonLdOrganization.type || 'Organization'}\n`;
            }

            if (global.seoJsonLdOrganization?.contactPoint?.telephone) {
              content += `- Contact: ${global.seoJsonLdOrganization.contactPoint.telephone}\n`;
            }

            content += '\n';

            // Reference sitemap if the module exists
            const hasSitemap = self.apos.modules['@apostrophecms/sitemap'];
            if (hasSitemap) {
              content += '## Sitemap\n\n';
              content += `- XML Sitemap: ${baseUrl}/sitemap.xml\n\n`;
            }

            // Key Pages - get top-level pages
            try {
              const pages = await self.apos.page.find(req, {
                level: { $lte: 1 },
                archived: { $ne: true }
              })
                .permission('view')
                .project({
                  title: 1,
                  _url: 1,
                  seoDescription: 1
                })
                .limit(10)
                .toArray();

              if (pages.length > 0) {
                content += '## Main Pages\n\n';
                pages.forEach(page => {
                  content += `### ${page.title}\n`;
                  content += `- URL: ${page._url}\n`;
                  if (page.seoDescription) {
                    content += `- Description: ${page.seoDescription}\n`;
                  }
                  content += '\n';
                });
              }
            } catch (err) {
              console.error('Error fetching pages for llms.txt:', err);
            }

            // Content Types Available
            content += '## Content Types\n\n';
            const pieceTypes = Object.values(self.apos.modules)
              .filter(m => m.__meta?.chain?.some(c => c.name === '@apostrophecms/piece-type'))
              .filter(m => {
                // Only exclude if explicitly set to false
                const seoFieldsOption = m.options?.seoFields;
                return seoFieldsOption !== false;
              })
              .filter(m => {
                // Filter out internal/system types
                // anything with @ or : is typically internal
                const name = m.__meta.name;
                return !name.startsWith('@apostrophecms/') &&
                  !name.startsWith('@apostrophecms-pro/') &&
                  !name.includes(':'); // Catches apostrophe:, aposPalette:, etc.
              })
              .map(m => ({
                name: m.__meta.name,
                label: m.label || m.options?.label || m.__meta.name
              }));

            if (pieceTypes.length > 0) {
              content += 'This site contains the following content types:\n\n';
              pieceTypes.forEach(type => {
                content += `- ${type.label}\n`;
              });
              content += '\n';
            }

            // Technical Details
            content += '## Technical Details\n\n';
            content += '- Platform: ApostropheCMS\n';
            content += '- SEO Module: @apostrophecms/seo\n';
            content += `- Robots: ${baseUrl}/robots.txt\n`;

            const schemaTypes = new Set();
            if (global.seoJsonLdOrganization?.name) {
              schemaTypes.add('Organization');
            }
            if (global.seoSiteName) {
              schemaTypes.add('WebSite');
            }

            if (schemaTypes.size > 0) {
              content += `- Structured Data: ${Array.from(schemaTypes).join(', ')}\n`;
            }

            content += '\n';

            // Footer
            content += '## For AI/LLM Systems\n\n';
            content += 'This site uses structured data (JSON-LD) on pages for better context.\n';
            content += 'Check individual pages for schema.org markup including:\n';
            content += '- WebPage/CollectionPage schemas\n';
            content += '- Article, Product, Event, Person schemas\n';
            content += '- BreadcrumbList navigation context\n';
            content += '- ItemList for collection pages\n';

            if (global.llmsTxtSelection === 'disallow') {
              content += '\n## Important\n\n';
              content += 'Please respect our AI training policy stated above. ';
              content += 'Use this content for real-time retrieval and user assistance only.\n';
            }

            req.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return content;
          } catch (err) {
            console.error('Error generating llms.txt:', err);
            req.res.status(500);
            return 'An error occurred generating llms.txt';
          }
        }
      }
    };
  }
};

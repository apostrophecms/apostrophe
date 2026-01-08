const assert = require('assert');

describe('@apostrophecms/seo', function () {

  describe('JSON-LD Schema Generation', function () {

    it('should generate WebSite schema with site name', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        global: {
          seoSiteName: 'Test Site',
          seoSiteCanonicalUrl: 'https://example.com'
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const websiteSchema = schemas.find(s => s['@type'] === 'WebSite');

      assert(websiteSchema, 'WebSite schema should exist');
      assert.strictEqual(websiteSchema.name, 'Test Site');
      assert.strictEqual(websiteSchema.url, 'https://example.com');
    });

    it('should generate Article schema with required fields', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        page: {
          title: 'Test Article',
          seoTitle: 'SEO Test Article',
          seoJsonLdType: 'Article',
          _url: 'https://example.com/test-article',
          createdAt: new Date('2024-01-01')
        },
        global: {
          seoJsonLdOrganization: {
            name: 'Test Organization'
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const articleSchema = schemas.find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist');
      assert.strictEqual(articleSchema.headline, 'SEO Test Article');
      assert.strictEqual(articleSchema.url, 'https://example.com/test-article');
      assert(articleSchema.datePublished, 'datePublished should exist');
      assert(articleSchema.publisher, 'publisher should exist');
      assert.strictEqual(articleSchema.publisher.name, 'Test Organization');
    });

    it('should use fallback from updatedBy.title', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        page: {
          title: 'Test Article',
          seoJsonLdType: 'Article',
          _url: 'https://example.com/test',
          createdAt: new Date(),
          updatedBy: {
            title: 'John Doe'
          }
        },
        global: {
          seoJsonLdOrganization: {
            name: 'Test Org'
          }
        }
      };

      const schemas = handler.generateSchemas(data);
      const articleSchema = schemas.find(s => s['@type'] === 'Article');
      console.log(articleSchema);// eslint-disable-line no-console

      assert(articleSchema.author, 'author should exist');
      assert.strictEqual(articleSchema.author.name, 'John Doe');
    });

    it('should generate Product schema with pricing', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Test Product',
          seoJsonLdType: 'Product',
          seoJsonLdProduct: {
            name: 'Amazing Widget',
            price: 29.99,
            currency: 'USD',
            availability: 'InStock',
            brand: 'TestBrand'
          },
          _url: 'https://example.com/products/widget'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const productSchema = schemas.find(s => s['@type'] === 'Product');

      assert(productSchema, 'Product schema should exist');
      assert.strictEqual(productSchema.name, 'Amazing Widget');
      assert(productSchema.offers, 'offers should exist');
      assert.strictEqual(productSchema.offers.price, '29.99');
      assert.strictEqual(productSchema.offers.priceCurrency, 'USD');
      assert(productSchema.brand, 'brand should exist');
      assert.strictEqual(productSchema.brand.name, 'TestBrand');
    });

    it('should not generate Recipe schema without required image', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Test Recipe',
          seoJsonLdType: 'Recipe',
          seoJsonLdRecipe: {
            name: 'Chocolate Cake'
            // Missing required image
          },
          _url: 'https://example.com/recipes/cake'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const recipeSchema = schemas.find(s => s['@type'] === 'Recipe');

      assert.strictEqual(recipeSchema, undefined, 'Recipe schema should not exist without image');
    });

    it('should generate FAQPage schema with questions', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        page: {
          title: 'FAQ Page',
          seoJsonLdType: 'FAQPage',
          seoJsonLdFAQ: {
            questions: [
              {
                question: 'What is SEO?',
                answer: 'Search Engine Optimization'
              },
              {
                question: 'Why is SEO important?',
                answer: 'It helps people find your website'
              }
            ]
          },
          _url: 'https://example.com/faq'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com'
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const faqSchema = schemas.find(s => s['@type'] === 'FAQPage');

      assert(faqSchema, 'FAQPage schema should exist');
      assert(Array.isArray(faqSchema.mainEntity), 'mainEntity should be an array');
      assert.strictEqual(faqSchema.mainEntity.length, 2);
      assert.strictEqual(faqSchema.mainEntity[0]['@type'], 'Question');
      assert.strictEqual(faqSchema.mainEntity[0].name, 'What is SEO?');
    });

    it('should generate ItemList for CollectionPage', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        page: {
          title: 'Blog Index',
          seoJsonLdType: 'CollectionPage',
          seoIncludeItemList: true,
          _url: 'https://example.com/blog'
        },
        pieces: [
          {
            title: 'First Post',
            _url: 'https://example.com/blog/first',
            seoDescription: 'First post description'
          },
          {
            title: 'Second Post',
            _url: 'https://example.com/blog/second',
            seoDescription: 'Second post description'
          }
        ],
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const itemListSchema = schemas.find(s => s['@type'] === 'ItemList');

      assert(itemListSchema, 'ItemList schema should exist');
      assert.strictEqual(itemListSchema.numberOfItems, 2);
      assert(Array.isArray(itemListSchema.itemListElement), 'itemListElement should be an array');
      assert.strictEqual(itemListSchema.itemListElement[0].item.name, 'First Post');
    });

    it('should generate Offer schema with seller fallback', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Special Offer',
          seoJsonLdType: 'Offer',
          seoJsonLdOffer: {
            name: 'Limited Time Deal',
            price: 99.99,
            priceCurrency: 'USD',
            availability: 'InStock'
          },
          _url: 'https://example.com/offers/deal'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: {
            name: 'ACME Corporation'
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const offerSchema = schemas.find(s => s['@type'] === 'Offer');

      assert(offerSchema, 'Offer schema should exist');
      assert.strictEqual(offerSchema.name, 'Limited Time Deal');
      assert.strictEqual(offerSchema.price, '99.99');
      assert(offerSchema.seller, 'seller should exist');
      assert.strictEqual(offerSchema.seller.name, 'ACME Corporation');
    });

    it('should generate AggregateOffer schema with price range', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Product Variants',
          seoJsonLdType: 'AggregateOffer',
          seoJsonLdAggregateOffer: {
            name: 'Widget Collection',
            lowPrice: 19.99,
            highPrice: 99.99,
            priceCurrency: 'USD',
            offerCount: 5
          },
          _url: 'https://example.com/products/widgets'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const aggOfferSchema = schemas.find(s => s['@type'] === 'AggregateOffer');

      assert(aggOfferSchema, 'AggregateOffer schema should exist');
      assert.strictEqual(aggOfferSchema.name, 'Widget Collection');
      assert.strictEqual(aggOfferSchema.lowPrice, '19.99');
      assert.strictEqual(aggOfferSchema.highPrice, '99.99');
      assert.strictEqual(aggOfferSchema.offerCount, 5);
    });

    it('should generate JobPosting schema with required fields', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Software Engineer Position',
          seoTitle: 'Senior Software Engineer - Remote',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Senior Software Engineer',
            description: 'Join our team as a senior software engineer...',
            datePosted: new Date('2024-01-01'),
            validThrough: new Date('2024-03-01'),
            employmentType: [ 'FULL_TIME' ],
            hiringOrganization: {
              name: 'Tech Corp',
              sameAs: 'https://techcorp.com'
            },
            jobLocation: {
              remote: true,
              applicantLocationRequirements: [
                { country: 'United States' }
              ]
            }
          },
          _url: 'https://example.com/jobs/senior-engineer',
          publishedAt: new Date('2024-01-01')
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: {
            name: 'Tech Corp',
            _logo: [ {
              attachment: {
                _urls: { original: 'https://example.com/logo.png' }
              }
            } ]
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert.strictEqual(jobSchema.title, 'Senior Software Engineer');
      assert.strictEqual(jobSchema.description, 'Join our team as a senior software engineer...');
      assert(jobSchema.datePosted, 'datePosted should exist');
      assert(jobSchema.validThrough, 'validThrough should exist');
      assert(Array.isArray(jobSchema.employmentType), 'employmentType should be array');
      assert(jobSchema.hiringOrganization, 'hiringOrganization should exist');
      assert.strictEqual(jobSchema.hiringOrganization.name, 'Tech Corp');
    });

    it('should handle remote job location with applicant requirements', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Remote Developer',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Remote Developer',
            description: 'Work from anywhere',
            validThrough: new Date('2024-12-31'),
            jobLocation: {
              remote: true,
              applicantLocationRequirements: [
                { country: 'United States' },
                { country: 'Canada' }
              ]
            }
          },
          _url: 'https://example.com/jobs/remote-dev'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert.strictEqual(jobSchema.jobLocationType, 'TELECOMMUTE');
      assert(Array.isArray(jobSchema.applicantLocationRequirements));
      assert.strictEqual(jobSchema.applicantLocationRequirements.length, 2);
      assert.strictEqual(jobSchema.applicantLocationRequirements[0]['@type'], 'Country');
      assert.strictEqual(jobSchema.applicantLocationRequirements[0].name, 'United States');
    });

    it('should handle physical job location', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Office Manager',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Office Manager',
            description: 'Manage our downtown office',
            validThrough: new Date('2024-12-31'),
            jobLocation: {
              remote: false,
              address: {
                street: '123 Main St',
                city: 'San Francisco',
                state: 'CA',
                zip: '94102',
                country: 'US'
              }
            }
          },
          _url: 'https://example.com/jobs/office-manager'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert(jobSchema.jobLocation, 'jobLocation should exist');
      assert.strictEqual(jobSchema.jobLocation['@type'], 'Place');
      assert(jobSchema.jobLocation.address, 'address should exist');
      assert.strictEqual(jobSchema.jobLocation.address.streetAddress, '123 Main St');
      assert.strictEqual(jobSchema.jobLocation.address.addressLocality, 'San Francisco');
      assert.strictEqual(jobSchema.jobLocation.address.addressRegion, 'CA');
    });

    it('should handle salary range', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Developer with Salary Range',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Developer',
            description: 'Great opportunity',
            validThrough: new Date('2024-12-31'),
            baseSalary: {
              minValue: 80000,
              maxValue: 120000,
              currency: 'USD',
              unitText: 'YEAR'
            }
          },
          _url: 'https://example.com/jobs/dev'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert(jobSchema.baseSalary, 'baseSalary should exist');
      assert.strictEqual(jobSchema.baseSalary['@type'], 'MonetaryAmount');
      assert.strictEqual(jobSchema.baseSalary.currency, 'USD');
      assert(jobSchema.baseSalary.value, 'salary value should exist');
      assert.strictEqual(jobSchema.baseSalary.value['@type'], 'QuantitativeValue');
      assert.strictEqual(jobSchema.baseSalary.value.minValue, 80000);
      assert.strictEqual(jobSchema.baseSalary.value.maxValue, 120000);
      assert.strictEqual(jobSchema.baseSalary.value.unitText, 'YEAR');
    });

    it('should handle fixed salary', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Developer with Fixed Salary',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Developer',
            description: 'Great opportunity',
            validThrough: new Date('2024-12-31'),
            baseSalary: {
              value: 100000,
              currency: 'USD',
              unitText: 'YEAR'
            }
          },
          _url: 'https://example.com/jobs/dev'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert(jobSchema.baseSalary, 'baseSalary should exist');
      assert(jobSchema.baseSalary.value, 'salary value should exist');
      assert.strictEqual(jobSchema.baseSalary.value.value, 100000);
      assert(!jobSchema.baseSalary.value.minValue, 'should not have minValue for fixed salary');
      assert(!jobSchema.baseSalary.value.maxValue, 'should not have maxValue for fixed salary');
    });

    it('should use global organization as hiring organization fallback', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Job without explicit hiring org',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Developer',
            description: 'Join our team',
            validThrough: new Date('2024-12-31')
            // No hiringOrganization specified
          },
          _url: 'https://example.com/jobs/dev'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: {
            name: 'Global Corp',
            _logo: [ {
              attachment: {
                _urls: { original: 'https://example.com/logo.png' }
              }
            } ]
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert(jobSchema.hiringOrganization, 'hiringOrganization should exist');
      assert.strictEqual(jobSchema.hiringOrganization.name, 'Global Corp');
      assert.strictEqual(jobSchema.hiringOrganization['@id'], 'https://example.com/#org');
      assert.strictEqual(jobSchema.hiringOrganization.logo, 'https://example.com/logo.png');
    });

    it('should handle skills array', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Developer',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Full Stack Developer',
            description: 'Build amazing things',
            validThrough: new Date('2024-12-31'),
            skills: [
              { skill: 'JavaScript' },
              { skill: 'React' },
              { skill: 'Node.js' }
            ]
          },
          _url: 'https://example.com/jobs/fullstack'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert(jobSchema.skills, 'skills should exist');
      assert.strictEqual(jobSchema.skills, 'JavaScript, React, Node.js');
    });

    it('should handle employment types array', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Flexible Position',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Flexible Developer',
            description: 'Full-time or part-time',
            validThrough: new Date('2024-12-31'),
            employmentType: [ 'FULL_TIME', 'PART_TIME' ]
          },
          _url: 'https://example.com/jobs/flexible'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert(Array.isArray(jobSchema.employmentType), 'employmentType should be array');
      assert.strictEqual(jobSchema.employmentType.length, 2);
      assert(jobSchema.employmentType.includes('FULL_TIME'));
      assert(jobSchema.employmentType.includes('PART_TIME'));
    });

    it('should not generate JobPosting without required title', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            // Missing title
            description: 'Great job',
            validThrough: new Date('2024-12-31')
          },
          _url: 'https://example.com/jobs/no-title'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert.strictEqual(jobSchema, undefined, 'JobPosting should not be generated without title');
    });

    it('should use description fallback chain', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Job with fallback description',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Developer',
            // No description in jobPosting
            validThrough: new Date('2024-12-31')
          },
          seoDescription: 'SEO description fallback',
          _url: 'https://example.com/jobs/fallback'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert.strictEqual(jobSchema.description, 'SEO description fallback');
    });

    it('should use datePosted fallback to publishedAt', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const publishDate = new Date('2024-01-15');

      const data = {
        piece: {
          title: 'Job with date fallback',
          seoJsonLdType: 'JobPosting',
          seoJsonLdJobPosting: {
            title: 'Developer',
            description: 'Join us',
            // No datePosted
            validThrough: new Date('2024-12-31')
          },
          publishedAt: publishDate,
          _url: 'https://example.com/jobs/date-fallback'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdOrganization: { name: 'Test Corp' }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const jobSchema = schemas.find(s => s['@type'] === 'JobPosting');

      assert(jobSchema, 'JobPosting schema should exist');
      assert.strictEqual(jobSchema.datePosted, publishDate);
    });

    it('should validate JobPosting required fields', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const validSchema = {
        '@type': 'JobPosting',
        title: 'Software Engineer',
        description: 'Build great software',
        datePosted: new Date().toISOString(),
        hiringOrganization: {
          '@type': 'Organization',
          name: 'Tech Corp'
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'San Francisco'
          }
        }
      };

      const isValid = handler.validateSchema(validSchema);
      assert.strictEqual(isValid, true);
    });

    it('should fail validation for incomplete JobPosting', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const invalidSchema = {
        '@type': 'JobPosting',
        title: 'Software Engineer'
        // Missing description, datePosted, hiringOrganization, jobLocation
      };

      const isValid = handler.validateSchema(invalidSchema);
      assert.strictEqual(isValid, false);
    });

    it('should generate Person schema with required fields', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Jane Doe Profile',
          seoJsonLdType: 'Person',
          seoJsonLdPerson: {
            name: 'Jane Doe',
            description: 'Software engineer and tech writer',
            jobTitle: 'Senior Software Engineer',
            organization: 'Tech Corp'
          },
          _url: 'https://example.com/people/jane-doe'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const personSchema = schemas.find(s => s['@type'] === 'Person');

      assert(personSchema, 'Person schema should exist');
      assert.strictEqual(personSchema.name, 'Jane Doe');
      assert.strictEqual(personSchema.description, 'Software engineer and tech writer');
      assert.strictEqual(personSchema.jobTitle, 'Senior Software Engineer');
      assert(personSchema.worksFor, 'worksFor should exist');
      assert.strictEqual(personSchema.worksFor.name, 'Tech Corp');
    });

    it('should not generate Person schema without required name', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Person without name',
          seoJsonLdType: 'Person',
          seoJsonLdPerson: {
            // Missing name
            description: 'A person'
          },
          _url: 'https://example.com/people/no-name'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const personSchema = schemas.find(s => s['@type'] === 'Person');

      assert.strictEqual(personSchema, undefined, 'Person schema should not generate without name');
    });

    it('should generate LocalBusiness schema with document-specific data', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Downtown Coffee Shop',
          seoJsonLdType: 'LocalBusiness',
          seoJsonLdBusiness: {
            name: 'Coffee Haven',
            description: 'Best coffee in town',
            telephone: '555-1234',
            address: {
              street: '123 Main St',
              city: 'San Francisco',
              state: 'CA',
              zip: '94102',
              country: 'US'
            },
            openingHours: [
              { hours: 'Mo-Fr 08:00-18:00' },
              { hours: 'Sa-Su 09:00-17:00' }
            ]
          },
          _url: 'https://example.com/locations/downtown'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com'
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const businessSchema = schemas.find(s => s['@type'] === 'LocalBusiness');

      assert(businessSchema, 'LocalBusiness schema should exist');
      assert.strictEqual(businessSchema.name, 'Coffee Haven');
      assert.strictEqual(businessSchema.telephone, '555-1234');
      assert(businessSchema.address, 'address should exist');
      assert.strictEqual(businessSchema.address.streetAddress, '123 Main St');
      assert(Array.isArray(businessSchema.openingHours), 'openingHours should be array');
      assert.strictEqual(businessSchema.openingHours.length, 2);
    });

    it('should generate LocalBusiness from global configuration', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        page: {
          title: 'Contact Us',
          seoJsonLdType: 'LocalBusiness'
        },
        global: {
          seoSiteCanonicalUrl: 'https://example.com',
          seoJsonLdBusiness: {
            name: 'Global Business Name',
            telephone: '555-9999',
            address: {
              city: 'New York',
              state: 'NY'
            }
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const businessSchema = schemas.find(s => s['@type'] === 'LocalBusiness');

      assert(businessSchema, 'LocalBusiness schema should exist');
      assert.strictEqual(businessSchema.name, 'Global Business Name');
      assert.strictEqual(businessSchema.url, 'https://example.com');
    });

    it('should generate QAPage with accepted answer', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        page: {
          title: 'How to install Node.js?',
          seoJsonLdType: 'QAPage',
          seoJsonLdQAPage: {
            question: 'How do I install Node.js?',
            questionText: 'I want to install Node.js on my Mac. What are the steps?',
            questionAuthor: 'John Developer',
            questionDate: new Date('2024-01-01'),
            questionUpvotes: 5,
            acceptedAnswer: {
              text: 'Download the installer from nodejs.org and run it.',
              author: 'Jane Expert',
              dateCreated: new Date('2024-01-02'),
              upvotes: 10
            }
          },
          _url: 'https://example.com/qa/install-nodejs'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const qaSchema = schemas.find(s => s['@type'] === 'QAPage');

      assert(qaSchema, 'QAPage schema should exist');
      assert(qaSchema.mainEntity, 'mainEntity should exist');
      assert.strictEqual(qaSchema.mainEntity['@type'], 'Question');
      assert.strictEqual(qaSchema.mainEntity.name, 'How do I install Node.js?');
      assert(qaSchema.mainEntity.acceptedAnswer, 'acceptedAnswer should exist');
      assert.strictEqual(qaSchema.mainEntity.acceptedAnswer['@type'], 'Answer');
    });

    it('should generate QAPage with suggested answers', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        page: {
          title: 'Best JavaScript framework?',
          seoJsonLdType: 'QAPage',
          seoJsonLdQAPage: {
            question: 'What is the best JavaScript framework?',
            suggestedAnswers: [
              {
                text: 'React is great for building UIs',
                author: 'Dev1',
                upvotes: 8
              },
              {
                text: 'Vue is simpler to learn',
                author: 'Dev2',
                upvotes: 5
              }
            ]
          },
          _url: 'https://example.com/qa/best-framework'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const qaSchema = schemas.find(s => s['@type'] === 'QAPage');

      assert(qaSchema, 'QAPage schema should exist');
      assert(qaSchema.mainEntity.suggestedAnswer, 'suggestedAnswer should exist');
      assert.strictEqual(qaSchema.mainEntity.suggestedAnswer.length, 2);
    });

    it('should generate VideoObject with required fields', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'How to Code Tutorial',
          seoJsonLdType: 'VideoObject',
          seoJsonLdVideo: {
            name: 'JavaScript Basics Tutorial',
            description: 'Learn JavaScript basics in 30 minutes',
            uploadDate: new Date('2024-01-01'),
            duration: 'PT30M',
            _thumbnail: [ {
              attachment: {
                _urls: { original: 'https://example.com/thumb.jpg' }
              }
            } ],
            contentUrl: 'https://example.com/video.mp4',
            embedUrl: 'https://example.com/embed/video'
          },
          _url: 'https://example.com/videos/js-basics'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const videoSchema = schemas.find(s => s['@type'] === 'VideoObject');

      assert(videoSchema, 'VideoObject schema should exist');
      assert.strictEqual(videoSchema.name, 'JavaScript Basics Tutorial');
      assert(videoSchema.thumbnailUrl, 'thumbnailUrl should exist (required by Google)');
      assert(videoSchema.uploadDate, 'uploadDate should exist (required by Google)');
      assert(videoSchema.contentUrl, 'contentUrl should exist');
    });

    it('should generate educational video properties', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Educational Video',
          seoJsonLdType: 'VideoObject',
          seoJsonLdVideo: {
            name: 'Advanced Math Lecture',
            description: 'Calculus lecture',
            uploadDate: new Date('2024-01-01'),
            _thumbnail: [ {
              attachment: {
                _urls: { original: 'https://example.com/thumb.jpg' }
              }
            } ],
            contentUrl: 'https://example.com/video.mp4',
            isEducational: true,
            educationalUse: 'assignment',
            learningResourceType: 'lecture'
          },
          _url: 'https://example.com/videos/calc'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const videoSchema = schemas.find(s => s['@type'] === 'VideoObject');

      assert(videoSchema, 'VideoObject schema should exist');
      assert.strictEqual(videoSchema.educationalUse, 'assignment');
      assert.strictEqual(videoSchema.learningResourceType, 'lecture');
    });

    it('should generate HowTo with steps', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'How to Bake a Cake',
          seoJsonLdType: 'HowTo',
          seoJsonLdHowTo: {
            name: 'Bake a Chocolate Cake',
            description: 'Simple chocolate cake recipe',
            totalTime: 'PT1H',
            supply: [
              { name: 'Flour' },
              { name: 'Sugar' },
              { name: 'Cocoa' }
            ],
            tool: [
              { name: 'Mixing bowl' },
              { name: 'Oven' }
            ],
            steps: [
              {
                name: 'Mix dry ingredients',
                text: 'Combine flour, sugar, and cocoa'
              },
              {
                name: 'Add wet ingredients',
                text: 'Add eggs and milk'
              },
              {
                name: 'Bake',
                text: 'Bake at 350°F for 30 minutes'
              }
            ]
          },
          _url: 'https://example.com/howto/bake-cake'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const howToSchema = schemas.find(s => s['@type'] === 'HowTo');

      assert(howToSchema, 'HowTo schema should exist');
      assert.strictEqual(howToSchema.name, 'Bake a Chocolate Cake');
      assert(Array.isArray(howToSchema.supply), 'supply should be array');
      assert(Array.isArray(howToSchema.tool), 'tool should be array');
      assert(Array.isArray(howToSchema.step), 'step should be array');
      assert.strictEqual(howToSchema.step.length, 3);
      assert.strictEqual(howToSchema.step[0].position, 1);
    });

    it('should generate Review schema', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Product Review',
          seoJsonLdType: 'Review',
          seoJsonLdReview: {
            itemReviewed: 'Amazing Widget',
            itemType: 'Product',
            reviewBody: 'This widget is fantastic!',
            reviewRating: 4.5,
            author: 'Jane Reviewer',
            datePublished: new Date('2024-01-01')
          },
          _url: 'https://example.com/reviews/widget'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const reviewSchema = schemas.find(s => s['@type'] === 'Review');

      assert(reviewSchema, 'Review schema should exist');
      assert(reviewSchema.itemReviewed, 'itemReviewed should exist');
      assert.strictEqual(reviewSchema.itemReviewed.name, 'Amazing Widget');
      assert(reviewSchema.reviewRating, 'reviewRating should exist');
      assert.strictEqual(reviewSchema.reviewRating.ratingValue, '4.5');
    });

    it('should generate Course schema', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const data = {
        piece: {
          title: 'Web Development Course',
          seoJsonLdType: 'Course',
          seoJsonLdCourse: {
            name: 'Full Stack Web Development',
            description: 'Learn to build web applications',
            provider: 'Tech Academy',
            courseCode: 'WEB-101',
            educationalLevel: 'Beginner',
            price: 99.99,
            currency: 'USD',
            rating: 4.8,
            reviewCount: 150
          },
          _url: 'https://example.com/courses/web-dev'
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const courseSchema = schemas.find(s => s['@type'] === 'Course');

      assert(courseSchema, 'Course schema should exist');
      assert.strictEqual(courseSchema.name, 'Full Stack Web Development');
      assert(courseSchema.provider, 'provider should exist');
      assert.strictEqual(courseSchema.provider.name, 'Tech Academy');
      assert(courseSchema.offers, 'offers should exist');
      assert.strictEqual(courseSchema.offers.price, '99.99');
    });
  });

  describe('Custom Field Mappings', function () {

    it('should use mapped author field when generating Article schema', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      // Simulate project-level field mapping configuration
      handler.seoFieldMappings = {
        author: 'writerName'
      };

      const data = {
        page: {
          title: 'Mapped Author Article',
          seoTitle: 'Mapped Author SEO Title',
          seoJsonLdType: 'Article',
          writerName: 'Mapped Author Name',
          author: 'Default Author Name',
          _url: 'https://example.com/mapped-article',
          createdAt: new Date('2024-01-01')
        },
        global: {
          seoJsonLdOrganization: {
            name: 'Test Organization'
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const articleSchema = schemas.find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist');
      assert(articleSchema.author, 'author should exist');
      assert.strictEqual(
        articleSchema.author.name,
        'Mapped Author Name',
        'Mapped author field should win over default author'
      );
    });

    it('should fall back to default author fields when mapped author field is empty', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      handler.seoFieldMappings = {
        author: 'writerName'
      };

      const data = {
        page: {
          title: 'Fallback Author Article',
          seoJsonLdType: 'Article',
          // Mapped field exists but is empty/whitespace
          writerName: '',
          author: 'Fallback Author',
          _url: 'https://example.com/fallback-article',
          createdAt: new Date('2024-01-02')
        },
        global: {
          seoJsonLdOrganization: {
            name: 'Test Organization'
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const articleSchema = schemas.find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist');
      assert(articleSchema.author, 'author should exist');
      assert.strictEqual(
        articleSchema.author.name,
        'Fallback Author',
        'Default author field should be used when mapped field is empty'
      );
    });

    it('should use mapped description field before seoDescription and description', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      handler.seoFieldMappings = {
        description: 'summary'
      };

      const data = {
        page: {
          title: 'Mapped Description Article',
          seoJsonLdType: 'Article',
          summary: 'Summary description from mapped field',
          seoDescription: 'SEO description fallback',
          description: 'Generic description',
          _url: 'https://example.com/mapped-description'
        },
        global: {
          seoJsonLdOrganization: {
            name: 'Test Organization'
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const articleSchema = schemas.find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist');
      assert.strictEqual(
        articleSchema.description,
        'Summary description from mapped field',
        'Mapped description field should be used first'
      );
    });

    it('should fall back from mapped description to standard fallbacks when mapped field is missing', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      handler.seoFieldMappings = {
        description: 'summary'
      };

      const data = {
        page: {
          title: 'Fallback Description Article',
          seoJsonLdType: 'Article',
          // No summary field at all
          seoDescription: 'SEO description value',
          description: 'Generic description value',
          _url: 'https://example.com/fallback-description'
        },
        global: {
          seoJsonLdOrganization: {
            name: 'Test Organization'
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const articleSchema = schemas.find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist');
      assert.strictEqual(
        articleSchema.description,
        'SEO description value',
        'Should fall back to seoDescription when mapped description field is missing'
      );
    });

    it('should use mapped image relationship when generating Product schema', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      handler.seoFieldMappings = {
        image: '_heroImage'
      };

      const data = {
        piece: {
          title: 'Mapped Product',
          seoJsonLdType: 'Product',
          seoJsonLdProduct: {
            name: 'Mapped Product Name',
            price: 10,
            currency: 'USD'
          },
          _url: 'https://example.com/mapped-product',
          // Mapped image relationship
          _heroImage: [
            {
              attachment: {
                _urls: {
                  original: 'https://example.com/uploads/hero-original.jpg',
                  full: 'https://example.com/uploads/hero-full.jpg'
                },
                width: 800,
                height: 600,
                title: 'Hero Image'
              },
              alt: 'Hero alt text'
            }
          ],
          // Default field that should be ignored when mapping is present
          _featuredImage: [
            {
              attachment: {
                _urls: {
                  original: 'https://example.com/uploads/featured-original.jpg'
                },
                width: 640,
                height: 480,
                title: 'Featured Image'
              },
              alt: 'Featured alt text'
            }
          ]
        },
        global: {},
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const productSchema = schemas.find(s => s['@type'] === 'Product');

      assert(productSchema, 'Product schema should exist');
      assert(productSchema.image, 'Product schema should include image');
      assert.strictEqual(
        productSchema.image,
        'https://example.com/uploads/hero-original.jpg',
        'Mapped image field should drive Product image'
      );
    });

    it('should use mapped published date field when generating Article schema', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      handler.seoFieldMappings = {
        publishedAt: 'publicationDate'
      };

      const publicationDate = new Date('2024-05-01T12:00:00Z');
      const createdAt = new Date('2024-04-01T12:00:00Z');

      const data = {
        page: {
          title: 'Mapped Date Article',
          seoJsonLdType: 'Article',
          publicationDate,
          publishedAt: createdAt, // would normally win without mapping
          _url: 'https://example.com/mapped-date'
        },
        global: {
          seoJsonLdOrganization: {
            name: 'Test Organization'
          }
        },
        req: {}
      };

      const schemas = handler.generateSchemas(data);
      const articleSchema = schemas.find(s => s['@type'] === 'Article');

      assert(articleSchema, 'Article schema should exist');
      assert(articleSchema.datePublished, 'datePublished should exist');

      // Normalise to ISO string for comparison
      const schemaDate = new Date(articleSchema.datePublished).toISOString();
      assert.strictEqual(
        schemaDate,
        publicationDate.toISOString(),
        'Mapped published date field should be used for datePublished'
      );
    });
  });

  describe('Custom Schema Registration', function () {

    it('should register and retrieve custom schemas', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');

      const customBookSchema = (data) => ({
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: data.piece?.title || 'Untitled Book'
      });

      const handler = new JsonLdSchemaHandler({
        Book: customBookSchema
      });

      // Assert it’s wired in
      assert(handler.schemas.Book, 'Custom Book schema should be registered');
      assert.strictEqual(typeof handler.schemas.Book, 'function');

      // Assert output looks right
      const data = {
        piece: {
          title: 'The Great Gatsby',
          seoJsonLdType: 'Book'
        },
        global: {},
        req: {}
      };

      const bookSchema = handler.schemas.Book(data);
      assert.strictEqual(bookSchema['@type'], 'Book');
      assert.strictEqual(bookSchema.name, 'The Great Gatsby');
    });
  });

  describe('Fallback System', function () {

    it('should use description fallbacks in correct order', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      // Test priority: schema.description → seoDescription → excerpt → description
      const document = {
        seoDescription: 'SEO description',
        excerpt: 'Excerpt text',
        description: 'General description'
      };

      const schemaData = {}; // No schema description
      const result = handler.getDescriptionWithFallbacks(schemaData, document);
      assert.strictEqual(result, 'SEO description');

      // Test next fallback
      delete document.seoDescription;
      const result2 = handler.getDescriptionWithFallbacks(schemaData, document);
      assert.strictEqual(result2, 'Excerpt text');

      // Test final fallback
      delete document.excerpt;
      const result3 = handler.getDescriptionWithFallbacks(schemaData, document);
      assert.strictEqual(result3, 'General description');
    });

    it('should use image fallbacks from multiple sources', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const document = {
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Featured image',
          width: 1200,
          height: 630
        }
      };

      const result = handler.getImageDataWithFallbacks({}, document);

      assert(result, 'result should exist');
      assert.strictEqual(result.url, 'https://example.com/image.jpg');
      assert.strictEqual(result.alt, 'Featured image');
    });

    it('should use author fallbacks in correct order', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      // Test with document-level author string
      const document = {
        author: 'Jane Smith'
      };
      const req = {};

      const result = handler.getAuthorName({}, document, req);
      assert.strictEqual(result, 'Jane Smith');

      // Test fallback to updatedBy.title
      const document2 = {
        updatedBy: { title: 'Admin User' }
      };
      const req2 = {};

      const result2 = handler.getAuthorName({}, document2, req2);
      assert.strictEqual(result2, 'Admin User');
    });

    it('should use date fallbacks for published dates', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const testDate = new Date('2024-01-15');
      const document = {
        publishedAt: testDate,
        createdAt: new Date('2024-01-01')
      };

      const result = handler.getDateWithFallbacks({}, document, 'published');
      assert.strictEqual(result, testDate);

      // Test fallback to createdAt
      delete document.publishedAt;
      const result2 = handler.getDateWithFallbacks({}, document, 'published');
      assert(result2 instanceof Date);
    });
  });

  describe('Meta Tag Generation', function () {

    it('should generate meta tags from nodes.js', function () {
      const { getMetaHead } = require('../lib/nodes');

      const data = {
        page: {
          seoTitle: 'Test Page Title',
          seoDescription: 'Test page description',
          seoRobots: [ 'noindex', 'nofollow' ]
        },
        global: {
          seoGoogleVerificationId: 'test-verification-id'
        }
      };

      const nodes = getMetaHead(data, { apos: {} });

      // Find title meta tag
      const titleNode = nodes.find(n =>
        n.attrs && n.attrs.name === 'title'
      );
      assert(titleNode, 'title meta tag should exist');
      assert.strictEqual(titleNode.attrs.content, 'Test Page Title');

      // Find description meta tag
      const descNode = nodes.find(n =>
        n.attrs && n.attrs.name === 'description'
      );
      assert(descNode, 'description meta tag should exist');
      assert.strictEqual(descNode.attrs.content, 'Test page description');

      // Find robots meta tag
      const robotsNode = nodes.find(n =>
        n.attrs && n.attrs.name === 'robots'
      );
      assert(robotsNode, 'robots meta tag should exist');
      assert.strictEqual(robotsNode.attrs.content, 'noindex,nofollow');

      // Find Google verification
      const verifyNode = nodes.find(n =>
        n.attrs && n.attrs.name === 'google-site-verification'
      );
      assert(verifyNode, 'verification meta tag should exist');
      assert.strictEqual(verifyNode.attrs.content, 'test-verification-id');
    });

    it('should generate canonical link when provided', function () {
      const { getMetaHead } = require('../lib/nodes');

      const data = {
        page: {
          _seoCanonical: [ {
            _url: 'https://example.com/canonical-page'
          } ]
        },
        global: {}
      };

      const nodes = getMetaHead(data, { apos: {} });
      const canonicalNode = nodes.find(n =>
        n.attrs && n.attrs.rel === 'canonical'
      );

      assert(canonicalNode, 'canonical link should exist');
      assert.strictEqual(canonicalNode.attrs.href, 'https://example.com/canonical-page');
    });

    it('should generate pagination links', function () {
      const { getMetaHead } = require('../lib/nodes');

      const data = {
        page: {
          _url: 'https://example.com/blog'
        },
        currentPage: 2,
        totalPages: 5,
        global: {}
      };

      const nodes = getMetaHead(data, { apos: {} });

      const prevNode = nodes.find(n =>
        n.attrs && n.attrs.rel === 'prev'
      );
      const nextNode = nodes.find(n =>
        n.attrs && n.attrs.rel === 'next'
      );

      assert(prevNode, 'prev link should exist');
      assert.strictEqual(prevNode.attrs.href, 'https://example.com/blog'); // Page 1 = clean URL

      assert(nextNode, 'next link should exist');
      assert.strictEqual(nextNode.attrs.href, 'https://example.com/blog?page=3');
    });

    it('should generate theme-color meta tags', function () {
      const { getMetaHead } = require('../lib/nodes');

      const data = {
        page: {},
        global: {
          seoThemeColor: {
            mode: 'lightDark',
            light: '#ffffff',
            dark: '#121212'
          }
        }
      };

      const nodes = getMetaHead(data, { apos: {} });

      const lightThemeNode = nodes.find(n =>
        n.attrs &&
        n.attrs.name === 'theme-color' &&
        n.attrs.media === '(prefers-color-scheme: light)'
      );

      const darkThemeNode = nodes.find(n =>
        n.attrs &&
        n.attrs.name === 'theme-color' &&
        n.attrs.media === '(prefers-color-scheme: dark)'
      );

      assert(lightThemeNode, 'light theme-color should exist');
      assert.strictEqual(lightThemeNode.attrs.content, '#ffffff');

      assert(darkThemeNode, 'dark theme-color should exist');
      assert.strictEqual(darkThemeNode.attrs.content, '#121212');
    });
  });

  describe('Utils', function () {

    it('should extract image data from relationship', function () {
      const { getImageData } = require('../lib/utils');

      const imageRelationship = [ {
        attachment: {
          _urls: {
            original: 'https://example.com/uploads/image.jpg',
            full: 'https://example.com/uploads/image-full.jpg'
          },
          width: 1920,
          height: 1080,
          title: 'Test Image'
        },
        alt: 'Alt text override'
      } ];

      const result = getImageData(imageRelationship);

      assert(result, 'result should exist');
      assert.strictEqual(result.url, 'https://example.com/uploads/image.jpg');
      assert.strictEqual(result.alt, 'Alt text override');
      assert.strictEqual(result.width, 1920);
      assert.strictEqual(result.height, 1080);
    });

    it('should return null for empty image relationship', function () {
      const { getImageData } = require('../lib/utils');

      assert.strictEqual(getImageData(null), null);
      assert.strictEqual(getImageData([]), null);
      assert.strictEqual(getImageData([ {} ]), null);
    });
  });

  describe('Schema Validation', function () {

    it('should validate Article schema requirements', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const validSchema = {
        '@type': 'Article',
        headline: 'Test Article',
        datePublished: new Date().toISOString(),
        author: {
          '@type': 'Person',
          name: 'John Doe'
        },
        publisher: {
          '@type': 'Organization',
          name: 'Test Org'
        }
      };

      const isValid = handler.validateSchema(validSchema);
      assert.strictEqual(isValid, true);
    });

    it('should fail validation for incomplete Product schema', function () {
      const JsonLdSchemaHandler = require('../lib/jsonld-schemas');
      const handler = new JsonLdSchemaHandler();

      const invalidSchema = {
        '@type': 'Product',
        name: 'Test Product'
        // Missing offers
      };

      const isValid = handler.validateSchema(invalidSchema);
      assert.strictEqual(isValid, false);
    });
  });
});

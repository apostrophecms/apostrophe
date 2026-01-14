// modules/@apostrophecms/doc-type/index.js
const _ = require('lodash');

module.exports = {
  improve: '@apostrophecms/doc-type',
  fields(self, options) {
    if (options.seoFields === false) {
      return;
    }

    // Determine schema type - explicit option takes precedence
    let defaultSchemaType = options.seoSchemaType;

    // Fallback to known module types if no explicit setting
    if (!defaultSchemaType) {
      if (options.apos.instanceOf(self, '@apostrophecms/blog')) {
        defaultSchemaType = 'Article';
      } else if (options.apos.instanceOf(self, '@apostrophecms/event')) {
        defaultSchemaType = 'Event';
      }
    }

    const configuration = {
      add: {
        // ALWAYS VISIBLE - Basic SEO fields (used for meta tags regardless of schema)
        seoTitle: {
          label: 'aposSeo:title',
          type: 'string',
          htmlHelp: 'aposSeo:titleHtmlHelp'
        },
        seoDescription: {
          label: 'aposSeo:description',
          type: 'string',
          htmlHelp: 'aposSeo:descriptionHtmlHelp'
        },
        seoRobots: {
          label: 'aposSeo:robots',
          htmlHelp: 'aposSeo:robotsHtmlHelp',
          type: 'checkboxes',
          choices: [
            {
              label: 'aposSeo:robotsNoFollow',
              value: 'nofollow'
            },
            {
              label: 'aposSeo:robotsNoIndex',
              value: 'noindex'
            }
          ]
        },
        seoIsPaywalled: {
          label: 'aposSeo:isPaywalled',
          type: 'boolean',
          help: 'aposSeo:isPaywalledHelp',
          def: false
        },
        seoPaywallSelector: {
          label: 'aposSeo:paywallSelector',
          type: 'string',
          help: 'aposSeo:paywallSelectorHelp',
          def: '.paywall',
          if: {
            seoIsPaywalled: true
          }
        },
        // SCHEMA TYPE SELECTOR
        seoJsonLdType: {
          label: 'aposSeo:schemaType',
          type: 'select',
          help: 'aposSeo:schemaTypeHelp',
          choices: 'getSchemaTypeChoices()',
          ...(defaultSchemaType && {
            def: defaultSchemaType,
            readOnly: true
          })
        },
        // CONDITIONAL: Product Schema Fields
        seoJsonLdProduct: {
          label: 'aposSeo:productDetails',
          type: 'object',
          help: 'aposSeo:productDetailsHelp',
          if: {
            seoJsonLdType: 'Product'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:productName',
                type: 'string',
                help: 'aposSeo:productNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:productDescription',
                type: 'string',
                textarea: true
              },
              price: {
                label: 'aposSeo:price',
                type: 'float'
              },
              currency: {
                label: 'aposSeo:currency',
                type: 'string',
                def: 'USD'
              },
              availability: {
                label: 'aposSeo:availability',
                type: 'select',
                def: 'InStock',
                choices: [
                  {
                    label: 'In Stock',
                    value: 'InStock'
                  },
                  {
                    label: 'Out of Stock',
                    value: 'OutOfStock'
                  },
                  {
                    label: 'Pre-order',
                    value: 'PreOrder'
                  },
                  {
                    label: 'Discontinued',
                    value: 'Discontinued'
                  }
                ]
              },
              brand: {
                label: 'aposSeo:brand',
                type: 'string'
              },
              sku: {
                label: 'aposSeo:sku',
                type: 'string',
                help: 'aposSeo:skuHelp'
              },
              gtin: {
                label: 'aposSeo:gtin',
                type: 'string',
                help: 'aposSeo:gtinHelp'
              },
              condition: {
                label: 'aposSeo:condition',
                type: 'select',
                def: 'NewCondition',
                choices: [
                  {
                    label: 'New',
                    value: 'NewCondition'
                  },
                  {
                    label: 'Used',
                    value: 'UsedCondition'
                  },
                  {
                    label: 'Refurbished',
                    value: 'RefurbishedCondition'
                  },
                  {
                    label: 'Damaged',
                    value: 'DamagedCondition'
                  }
                ]
              },
              rating: {
                label: 'aposSeo:rating',
                type: 'float',
                min: 0,
                max: 5,
                help: 'aposSeo:ratingHelp'
              },
              reviewCount: {
                label: 'aposSeo:reviewCount',
                type: 'integer',
                min: 0,
                help: 'aposSeo:reviewCountHelp'
              }
            }
          }
        },
        // CONDITIONAL: Event Schema Fields
        seoJsonLdEvent: {
          label: 'aposSeo:eventDetails',
          type: 'object',
          help: 'aposSeo:eventDetailsHelp',
          if: {
            seoJsonLdType: 'Event'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:eventName',
                type: 'string',
                help: 'aposSeo:eventNameHelp'
              },
              description: {
                label: 'aposSeo:eventDescription',
                type: 'string',
                textarea: true
              },
              startDate: {
                label: 'aposSeo:startDate',
                type: 'dateAndTime'
              },
              endDate: {
                label: 'aposSeo:endDate',
                type: 'dateAndTime'
              },
              location: {
                label: 'aposSeo:eventLocation',
                type: 'object',
                fields: {
                  add: {
                    name: {
                      label: 'aposSeo:locationName',
                      type: 'string'
                    },
                    address: {
                      label: 'aposSeo:locationAddress',
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        // CONDITIONAL: Person Schema Fields
        seoJsonLdPerson: {
          label: 'aposSeo:personDetails',
          type: 'object',
          help: 'aposSeo:personDetailsHelp',
          if: {
            seoJsonLdType: 'Person'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:personName',
                type: 'string',
                help: 'aposSeo:personNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:personDescription',
                type: 'string',
                textarea: true
              },
              jobTitle: {
                label: 'aposSeo:jobTitle',
                type: 'string'
              },
              organization: {
                label: 'aposSeo:organization',
                type: 'string'
              }
            }
          }
        },
        // CONDITIONAL: Local Business Schema Fields
        seoJsonLdBusiness: {
          label: 'aposSeo:businessDetails',
          type: 'object',
          help: 'aposSeo:businessDetailsHelp',
          if: {
            seoJsonLdType: 'LocalBusiness'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:businessName',
                type: 'string',
                required: true
              },
              description: {
                label: 'aposSeo:businessDescription',
                type: 'string',
                textarea: true
              },
              telephone: {
                label: 'aposSeo:businessPhone',
                type: 'string'
              },
              address: {
                label: 'aposSeo:businessAddress',
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
              },
              openingHours: {
                label: 'aposSeo:openingHours',
                type: 'array',
                titleField: 'hours',
                fields: {
                  add: {
                    hours: {
                      label: 'aposSeo:hours',
                      type: 'string',
                      help: 'aposSeo:hoursHelp'
                    }
                  }
                }
              }
            }
          }
        },
        // CONDITIONAL: Local Business Schema Fields
        seoJsonLdJobPosting: {
          label: 'aposSeo:jobPostingDetails',
          type: 'object',
          help: 'aposSeo:jobPostingDetailsHelp',
          if: {
            seoJsonLdType: 'JobPosting'
          },
          fields: {
            add: {
              title: {
                label: 'aposSeo:jobTitle',
                type: 'string',
                help: 'aposSeo:jobTitleHelp',
                required: true
              },
              description: {
                label: 'aposSeo:jobDescription',
                type: 'string',
                textarea: true,
                help: 'aposSeo:jobDescriptionHelp'
              },
              datePosted: {
                label: 'aposSeo:datePosted',
                type: 'date',
                help: 'aposSeo:datePostedHelp'
              },
              validThrough: {
                label: 'aposSeo:validThrough',
                type: 'date',
                help: 'aposSeo:validThroughHelp',
                required: true
              },
              employmentType: {
                label: 'aposSeo:employmentType',
                type: 'checkboxes',
                help: 'aposSeo:employmentTypeHelp',
                choices: [
                  {
                    label: 'Full-time',
                    value: 'FULL_TIME'
                  },
                  {
                    label: 'Part-time',
                    value: 'PART_TIME'
                  },
                  {
                    label: 'Contractor',
                    value: 'CONTRACTOR'
                  },
                  {
                    label: 'Temporary',
                    value: 'TEMPORARY'
                  },
                  {
                    label: 'Intern',
                    value: 'INTERN'
                  },
                  {
                    label: 'Volunteer',
                    value: 'VOLUNTEER'
                  },
                  {
                    label: 'Per Diem',
                    value: 'PER_DIEM'
                  },
                  {
                    label: 'Other',
                    value: 'OTHER'
                  }
                ]
              },
              hiringOrganization: {
                label: 'aposSeo:hiringOrganization',
                type: 'object',
                help: 'aposSeo:hiringOrganizationHelp',
                fields: {
                  add: {
                    name: {
                      label: 'aposSeo:companyName',
                      type: 'string',
                      help: 'aposSeo:companyNameHelp'
                    },
                    sameAs: {
                      label: 'aposSeo:companyWebsite',
                      type: 'url',
                      help: 'aposSeo:companyWebsiteHelp'
                    },
                    _logo: {
                      label: 'aposSeo:companyLogo',
                      type: 'relationship',
                      withType: '@apostrophecms/image',
                      max: 1,
                      help: 'aposSeo:companyLogoHelp'
                    }
                  }
                }
              },
              jobLocation: {
                label: 'aposSeo:jobLocation',
                type: 'object',
                help: 'aposSeo:jobLocationHelp',
                fields: {
                  add: {
                    remote: {
                      label: 'aposSeo:remotePosition',
                      type: 'boolean',
                      help: 'aposSeo:remotePositionHelp'
                    },
                    applicantLocationRequirements: {
                      label: 'aposSeo:applicantLocationRequirements',
                      type: 'array',
                      help: 'aposSeo:applicantLocationRequirementsHelp',
                      titleField: 'country',
                      if: {
                        remote: true
                      },
                      fields: {
                        add: {
                          country: {
                            label: 'aposSeo:country',
                            type: 'string',
                            required: true
                          }
                        }
                      }
                    },
                    address: {
                      label: 'aposSeo:physicalAddress',
                      type: 'object',
                      help: 'aposSeo:physicalAddressHelp',
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
              baseSalary: {
                label: 'aposSeo:baseSalary',
                type: 'object',
                help: 'aposSeo:baseSalaryHelp',
                fields: {
                  add: {
                    minValue: {
                      label: 'aposSeo:salaryMin',
                      type: 'float',
                      help: 'aposSeo:salaryMinHelp'
                    },
                    maxValue: {
                      label: 'aposSeo:salaryMax',
                      type: 'float',
                      help: 'aposSeo:salaryMaxHelp'
                    },
                    value: {
                      label: 'aposSeo:salaryFixed',
                      type: 'float',
                      help: 'aposSeo:salaryFixedHelp'
                    },
                    currency: {
                      label: 'aposSeo:currency',
                      type: 'string',
                      def: 'USD'
                    },
                    unitText: {
                      label: 'aposSeo:salaryUnit',
                      type: 'select',
                      def: 'YEAR',
                      choices: [
                        {
                          label: 'Per Year',
                          value: 'YEAR'
                        },
                        {
                          label: 'Per Month',
                          value: 'MONTH'
                        },
                        {
                          label: 'Per Week',
                          value: 'WEEK'
                        },
                        {
                          label: 'Per Day',
                          value: 'DAY'
                        },
                        {
                          label: 'Per Hour',
                          value: 'HOUR'
                        }
                      ]
                    }
                  }
                }
              },
              experienceRequirements: {
                label: 'aposSeo:experienceRequirements',
                type: 'string',
                help: 'aposSeo:experienceRequirementsHelp'
              },
              educationRequirements: {
                label: 'aposSeo:educationRequirements',
                type: 'select',
                help: 'aposSeo:educationRequirementsHelp',
                choices: [
                  {
                    label: 'High School',
                    value: 'HighSchool'
                  },
                  {
                    label: 'Associate Degree',
                    value: 'AssociateDegree'
                  },
                  {
                    label: 'Bachelor Degree',
                    value: 'BachelorDegree'
                  },
                  {
                    label: 'Master Degree',
                    value: 'MasterDegree'
                  },
                  {
                    label: 'Doctorate',
                    value: 'Doctorate'
                  },
                  {
                    label: 'Professional Certificate',
                    value: 'ProfessionalCertificate'
                  }
                ]
              },
              qualifications: {
                label: 'aposSeo:qualifications',
                type: 'string',
                textarea: true,
                help: 'aposSeo:qualificationsHelp'
              },
              responsibilities: {
                label: 'aposSeo:responsibilities',
                type: 'string',
                textarea: true,
                help: 'aposSeo:responsibilitiesHelp'
              },
              skills: {
                label: 'aposSeo:skills',
                type: 'array',
                titleField: 'skill',
                help: 'aposSeo:skillsHelp',
                fields: {
                  add: {
                    skill: {
                      label: 'aposSeo:skill',
                      type: 'string',
                      required: true
                    }
                  }
                }
              },
              jobBenefits: {
                label: 'aposSeo:jobBenefits',
                type: 'string',
                textarea: true,
                help: 'aposSeo:jobBenefitsHelp'
              },
              industry: {
                label: 'aposSeo:industry',
                type: 'string',
                help: 'aposSeo:industryHelp'
              },
              occupationalCategory: {
                label: 'aposSeo:occupationalCategory',
                type: 'string',
                help: 'aposSeo:occupationalCategoryHelp'
              },
              workHours: {
                label: 'aposSeo:workHours',
                type: 'string',
                help: 'aposSeo:workHoursHelp'
              },
              directApply: {
                label: 'aposSeo:directApply',
                type: 'boolean',
                help: 'aposSeo:directApplyHelp'
              }
            }
          }
        },
        // CONDITIONAL: FAQ Page Fields
        seoJsonLdFAQ: {
          label: 'aposSeo:faqDetails',
          type: 'object',
          help: 'aposSeo:faqDetailsHelp',
          if: {
            seoJsonLdType: 'FAQPage'
          },
          fields: {
            add: {
              questions: {
                label: 'aposSeo:faqQuestions',
                type: 'array',
                titleField: 'question',
                fields: {
                  add: {
                    question: {
                      label: 'aposSeo:question',
                      type: 'string',
                      required: true
                    },
                    answer: {
                      label: 'aposSeo:answer',
                      type: 'string',
                      textarea: true,
                      required: true
                    }
                  }
                }
              }
            }
          }
        },
        // CONDITIONAL: Q&A Page Fields
        seoJsonLdQAPage: {
          label: 'aposSeo:qaPageDetails',
          type: 'object',
          help: 'aposSeo:qaPageDetailsHelp',
          if: {
            seoJsonLdType: 'QAPage'
          },
          fields: {
            add: {
              question: {
                label: 'aposSeo:qaQuestion',
                type: 'string',
                help: 'aposSeo:qaQuestionHelp',
                required: true
              },
              questionText: {
                label: 'aposSeo:qaQuestionText',
                type: 'string',
                textarea: true,
                help: 'aposSeo:qaQuestionTextHelp'
              },
              questionAuthor: {
                label: 'aposSeo:qaQuestionAuthor',
                type: 'string',
                help: 'aposSeo:qaQuestionAuthorHelp'
              },
              questionDate: {
                label: 'aposSeo:qaQuestionDate',
                type: 'date',
                help: 'aposSeo:qaQuestionDateHelp'
              },
              questionUpvotes: {
                label: 'aposSeo:qaQuestionUpvotes',
                type: 'integer',
                min: 0,
                help: 'aposSeo:qaQuestionUpvotesHelp'
              },
              acceptedAnswer: {
                label: 'aposSeo:qaAcceptedAnswer',
                type: 'object',
                help: 'aposSeo:qaAcceptedAnswerHelp',
                fields: {
                  add: {
                    text: {
                      label: 'aposSeo:qaAnswerText',
                      type: 'string',
                      textarea: true,
                      required: true
                    },
                    author: {
                      label: 'aposSeo:qaAnswerAuthor',
                      type: 'string'
                    },
                    dateCreated: {
                      label: 'aposSeo:qaAnswerDate',
                      type: 'date'
                    },
                    upvotes: {
                      label: 'aposSeo:qaAnswerUpvotes',
                      type: 'integer',
                      min: 0
                    }
                  }
                }
              },
              suggestedAnswers: {
                label: 'aposSeo:qaSuggestedAnswers',
                type: 'array',
                titleField: 'text',
                help: 'aposSeo:qaSuggestedAnswersHelp',
                fields: {
                  add: {
                    text: {
                      label: 'aposSeo:qaAnswerText',
                      type: 'string',
                      textarea: true,
                      required: true
                    },
                    author: {
                      label: 'aposSeo:qaAnswerAuthor',
                      type: 'string'
                    },
                    dateCreated: {
                      label: 'aposSeo:qaAnswerDate',
                      type: 'date'
                    },
                    upvotes: {
                      label: 'aposSeo:qaAnswerUpvotes',
                      type: 'integer',
                      min: 0
                    }
                  }
                }
              }
            }
          }
        },
        // CONDITIONAL: Video Object Fields
        seoJsonLdVideo: {
          label: 'aposSeo:videoDetails',
          type: 'object',
          help: 'aposSeo:videoDetailsHelp',
          if: {
            seoJsonLdType: 'VideoObject'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:videoName',
                type: 'string',
                help: 'aposSeo:videoNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:videoDescription',
                type: 'string',
                textarea: true
              },
              uploadDate: {
                label: 'aposSeo:videoUploadDate',
                type: 'date'
              },
              duration: {
                label: 'aposSeo:videoDuration',
                type: 'string',
                help: 'aposSeo:videoDurationHelp'
              },
              _thumbnail: {
                label: 'aposSeo:videoThumbnail',
                type: 'relationship',
                withType: '@apostrophecms/image',
                max: 1,
                help: 'aposSeo:videoThumbnailHelp'
              },
              contentUrl: {
                label: 'aposSeo:videoUrl',
                type: 'url',
                help: 'aposSeo:videoUrlHelp'
              },
              embedUrl: {
                label: 'aposSeo:videoEmbedUrl',
                type: 'url',
                help: 'aposSeo:videoEmbedUrlHelp'
              },
              isEducational: {
                label: 'aposSeo:isEducationalVideo',
                type: 'boolean',
                help: 'aposSeo:isEducationalVideoHelp'
              },
              educationalUse: {
                label: 'aposSeo:educationalUse',
                type: 'select',
                help: 'aposSeo:educationalUseHelp',
                if: {
                  isEducational: true
                },
                choices: [
                  {
                    label: 'Assignment',
                    value: 'assignment'
                  },
                  {
                    label: 'Professional Development',
                    value: 'professional development'
                  },
                  {
                    label: 'Continuing Education',
                    value: 'continuing education'
                  },
                  {
                    label: 'Vocational Training',
                    value: 'vocational training'
                  }
                ]
              },
              learningResourceType: {
                label: 'aposSeo:learningResourceType',
                type: 'select',
                help: 'aposSeo:learningResourceTypeHelp',
                if: {
                  isEducational: true
                },
                choices: [
                  {
                    label: 'Lecture',
                    value: 'lecture'
                  },
                  {
                    label: 'Tutorial',
                    value: 'tutorial'
                  },
                  {
                    label: 'Demonstration',
                    value: 'demonstration'
                  },
                  {
                    label: 'Presentation',
                    value: 'presentation'
                  },
                  {
                    label: 'Exercise',
                    value: 'exercise'
                  }
                ]
              }
            }
          }
        },
        // CONDITIONAL: HowTo Schema Fields
        seoJsonLdHowTo: {
          label: 'aposSeo:howToDetails',
          type: 'object',
          help: 'aposSeo:howToDetailsHelp',
          if: {
            seoJsonLdType: 'HowTo'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:howToName',
                type: 'string',
                help: 'aposSeo:howToNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:howToDescription',
                type: 'string',
                textarea: true
              },
              totalTime: {
                label: 'aposSeo:totalTime',
                type: 'string',
                help: 'aposSeo:totalTimeHelp'
              },
              supply: {
                label: 'aposSeo:supplies',
                type: 'array',
                titleField: 'name',
                help: 'aposSeo:suppliesHelp',
                fields: {
                  add: {
                    name: {
                      label: 'aposSeo:supplyName',
                      type: 'string',
                      required: true
                    }
                  }
                }
              },
              tool: {
                label: 'aposSeo:tools',
                type: 'array',
                titleField: 'name',
                help: 'aposSeo:toolsHelp',
                fields: {
                  add: {
                    name: {
                      label: 'aposSeo:toolName',
                      type: 'string',
                      required: true
                    }
                  }
                }
              },
              steps: {
                label: 'aposSeo:steps',
                type: 'array',
                titleField: 'name',
                help: 'aposSeo:stepsHelp',
                fields: {
                  add: {
                    name: {
                      label: 'aposSeo:stepName',
                      type: 'string',
                      required: true
                    },
                    text: {
                      label: 'aposSeo:stepText',
                      type: 'string',
                      textarea: true,
                      required: true
                    },
                    url: {
                      label: 'aposSeo:stepUrl',
                      type: 'url'
                    },
                    _image: {
                      label: 'aposSeo:stepImage',
                      type: 'relationship',
                      withType: '@apostrophecms/image',
                      max: 1
                    }
                  }
                }
              }
            }
          }
        },
        // CONDITIONAL: Review Schema Fields
        seoJsonLdReview: {
          label: 'aposSeo:reviewDetails',
          type: 'object',
          help: 'aposSeo:reviewDetailsHelp',
          if: {
            seoJsonLdType: 'Review'
          },
          fields: {
            add: {
              itemReviewed: {
                label: 'aposSeo:itemReviewed',
                type: 'string',
                help: 'aposSeo:itemReviewedHelp',
                required: true
              },
              itemType: {
                label: 'aposSeo:itemType',
                type: 'select',
                def: 'Thing',
                choices: [
                  {
                    label: 'Thing',
                    value: 'Thing'
                  },
                  {
                    label: 'Product',
                    value: 'Product'
                  },
                  {
                    label: 'Book',
                    value: 'Book'
                  },
                  {
                    label: 'Movie',
                    value: 'Movie'
                  },
                  {
                    label: 'Restaurant',
                    value: 'Restaurant'
                  },
                  {
                    label: 'Service',
                    value: 'Service'
                  }
                ]
              },
              reviewBody: {
                label: 'aposSeo:reviewBody',
                type: 'string',
                textarea: true
              },
              reviewRating: {
                label: 'aposSeo:reviewRating',
                type: 'float',
                min: 1,
                max: 5,
                help: 'aposSeo:reviewRatingHelp'
              },
              author: {
                label: 'aposSeo:reviewAuthor',
                type: 'string',
                help: 'aposSeo:reviewAuthorHelp'
              },
              datePublished: {
                label: 'aposSeo:reviewDate',
                type: 'date'
              }
            }
          }
        },
        // CONDITIONAL: Recipe Schema Fields
        seoJsonLdRecipe: {
          label: 'aposSeo:recipeDetails',
          type: 'object',
          help: 'aposSeo:recipeDetailsHelp',
          if: {
            seoJsonLdType: 'Recipe'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:recipeName',
                type: 'string',
                help: 'aposSeo:recipeNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:recipeDescription',
                type: 'string',
                textarea: true
              },
              author: {
                label: 'aposSeo:recipeAuthor',
                type: 'string'
              },
              prepTime: {
                label: 'aposSeo:prepTime',
                type: 'string',
                help: 'aposSeo:prepTimeHelp'
              },
              cookTime: {
                label: 'aposSeo:cookTime',
                type: 'string',
                help: 'aposSeo:cookTimeHelp'
              },
              totalTime: {
                label: 'aposSeo:totalTime',
                type: 'string',
                help: 'aposSeo:totalTimeHelp'
              },
              recipeYield: {
                label: 'aposSeo:recipeYield',
                type: 'string',
                help: 'aposSeo:recipeYieldHelp'
              },
              recipeCategory: {
                label: 'aposSeo:recipeCategory',
                type: 'string',
                help: 'aposSeo:recipeCategoryHelp'
              },
              recipeCuisine: {
                label: 'aposSeo:recipeCuisine',
                type: 'string',
                help: 'aposSeo:recipeCuisineHelp'
              },
              recipeIngredient: {
                label: 'aposSeo:recipeIngredients',
                type: 'array',
                titleField: 'ingredient',
                help: 'aposSeo:recipeIngredientsHelp',
                fields: {
                  add: {
                    ingredient: {
                      label: 'aposSeo:ingredient',
                      type: 'string',
                      required: true
                    }
                  }
                }
              },
              recipeInstructions: {
                label: 'aposSeo:recipeInstructions',
                type: 'array',
                titleField: 'instruction',
                help: 'aposSeo:recipeInstructionsHelp',
                fields: {
                  add: {
                    instruction: {
                      label: 'aposSeo:instruction',
                      type: 'string',
                      textarea: true,
                      required: true
                    }
                  }
                }
              },
              video: {
                label: 'aposSeo:recipeVideo',
                type: 'url',
                help: 'aposSeo:recipeVideoHelp'
              },
              keywords: {
                label: 'aposSeo:recipeKeywords',
                type: 'string',
                help: 'aposSeo:recipeKeywordsHelp'
              },
              nutrition: {
                label: 'aposSeo:nutritionInfo',
                type: 'object',
                help: 'aposSeo:nutritionInfoHelp',
                fields: {
                  add: {
                    calories: {
                      label: 'aposSeo:calories',
                      type: 'string',
                      help: 'aposSeo:caloriesHelp'
                    },
                    carbohydrateContent: {
                      label: 'aposSeo:carbs',
                      type: 'string'
                    },
                    proteinContent: {
                      label: 'aposSeo:protein',
                      type: 'string'
                    },
                    fatContent: {
                      label: 'aposSeo:fat',
                      type: 'string'
                    }
                  }
                }
              },
              rating: {
                label: 'aposSeo:rating',
                type: 'float',
                min: 0,
                max: 5,
                help: 'aposSeo:ratingHelp'
              },
              reviewCount: {
                label: 'aposSeo:reviewCount',
                type: 'integer',
                min: 0,
                help: 'aposSeo:reviewCountHelp'
              },
              datePublished: {
                label: 'aposSeo:datePublished',
                type: 'date'
              }
            }
          }
        },
        // CONDITIONAL: Course Schema Fields
        seoJsonLdCourse: {
          label: 'aposSeo:courseDetails',
          type: 'object',
          help: 'aposSeo:courseDetailsHelp',
          if: {
            seoJsonLdType: 'Course'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:courseName',
                type: 'string',
                help: 'aposSeo:courseNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:courseDescription',
                type: 'string',
                textarea: true,
                required: true
              },
              provider: {
                label: 'aposSeo:courseProvider',
                type: 'string',
                help: 'aposSeo:courseProviderHelp'
              },
              courseCode: {
                label: 'aposSeo:courseCode',
                type: 'string',
                help: 'aposSeo:courseCodeHelp'
              },
              educationalLevel: {
                label: 'aposSeo:educationalLevel',
                type: 'select',
                choices: [
                  {
                    label: 'Beginner',
                    value: 'Beginner'
                  },
                  {
                    label: 'Intermediate',
                    value: 'Intermediate'
                  },
                  {
                    label: 'Advanced',
                    value: 'Advanced'
                  }
                ]
              },
              price: {
                label: 'aposSeo:price',
                type: 'float',
                help: 'aposSeo:coursePriceHelp'
              },
              currency: {
                label: 'aposSeo:currency',
                type: 'string',
                def: 'USD'
              },
              availability: {
                label: 'aposSeo:availability',
                type: 'select',
                def: 'InStock',
                choices: [
                  {
                    label: 'In Stock',
                    value: 'InStock'
                  },
                  {
                    label: 'Out of Stock',
                    value: 'OutOfStock'
                  },
                  {
                    label: 'Pre-order',
                    value: 'PreOrder'
                  }
                ]
              },
              rating: {
                label: 'aposSeo:rating',
                type: 'float',
                min: 0,
                max: 5,
                help: 'aposSeo:ratingHelp'
              },
              reviewCount: {
                label: 'aposSeo:reviewCount',
                type: 'integer',
                min: 0,
                help: 'aposSeo:reviewCountHelp'
              }
            }
          }
        },
        // CONDITIONAL: ItemList toggle (only for collection/listing pages)
        seoIncludeItemList: {
          label: 'aposSeo:includeItemList',
          help: 'aposSeo:includeItemListHelp',
          type: 'boolean',
          def: true,
          if: {
            seoJsonLdType: 'CollectionPage'
          }
        },
        // CONDITIONAL: Offer Schema Fields
        seoJsonLdOffer: {
          label: 'aposSeo:offerDetails',
          type: 'object',
          help: 'aposSeo:offerDetailsHelp',
          if: {
            seoJsonLdType: 'Offer'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:offerName',
                type: 'string',
                help: 'aposSeo:offerNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:offerDescription',
                type: 'string',
                textarea: true
              },
              price: {
                label: 'aposSeo:price',
                type: 'float',
                help: 'aposSeo:offerPriceHelp',
                required: true
              },
              priceCurrency: {
                label: 'aposSeo:currency',
                type: 'string',
                def: 'USD',
                help: 'aposSeo:currencyHelp'
              },
              availability: {
                label: 'aposSeo:availability',
                type: 'select',
                def: 'InStock',
                choices: [
                  {
                    label: 'In Stock',
                    value: 'InStock'
                  },
                  {
                    label: 'Out of Stock',
                    value: 'OutOfStock'
                  },
                  {
                    label: 'Pre-order',
                    value: 'PreOrder'
                  },
                  {
                    label: 'Discontinued',
                    value: 'Discontinued'
                  },
                  {
                    label: 'Limited Availability',
                    value: 'LimitedAvailability'
                  },
                  {
                    label: 'Online Only',
                    value: 'OnlineOnly'
                  },
                  {
                    label: 'In Store Only',
                    value: 'InStoreOnly'
                  },
                  {
                    label: 'Sold Out',
                    value: 'SoldOut'
                  }
                ]
              },
              validFrom: {
                label: 'aposSeo:validFrom',
                type: 'date',
                help: 'aposSeo:validFromHelp'
              },
              priceValidUntil: {
                label: 'aposSeo:priceValidUntil',
                type: 'date',
                help: 'aposSeo:priceValidUntilHelp'
              },
              seller: {
                label: 'aposSeo:seller',
                type: 'string',
                help: 'aposSeo:sellerHelp'
              },
              itemCondition: {
                label: 'aposSeo:itemCondition',
                type: 'select',
                def: 'NewCondition',
                choices: [
                  {
                    label: 'New',
                    value: 'NewCondition'
                  },
                  {
                    label: 'Used',
                    value: 'UsedCondition'
                  },
                  {
                    label: 'Refurbished',
                    value: 'RefurbishedCondition'
                  },
                  {
                    label: 'Damaged',
                    value: 'DamagedCondition'
                  }
                ]
              },
              shippingDetails: {
                label: 'aposSeo:shippingDetails',
                type: 'object',
                fields: {
                  add: {
                    shippingRate: {
                      label: 'aposSeo:shippingRate',
                      type: 'float',
                      help: 'aposSeo:shippingRateHelp'
                    },
                    shippingDestination: {
                      label: 'aposSeo:shippingDestination',
                      type: 'string',
                      help: 'aposSeo:shippingDestinationHelp'
                    },
                    deliveryTime: {
                      label: 'aposSeo:deliveryTime',
                      type: 'string',
                      help: 'aposSeo:deliveryTimeHelp'
                    }
                  }
                }
              }
            }
          }
        },
        // CONDITIONAL: AggregateOffer Schema Fields
        seoJsonLdAggregateOffer: {
          label: 'aposSeo:aggregateOfferDetails',
          type: 'object',
          help: 'aposSeo:aggregateOfferDetailsHelp',
          if: {
            seoJsonLdType: 'AggregateOffer'
          },
          fields: {
            add: {
              name: {
                label: 'aposSeo:aggregateOfferName',
                type: 'string',
                help: 'aposSeo:aggregateOfferNameHelp',
                required: true
              },
              description: {
                label: 'aposSeo:aggregateOfferDescription',
                type: 'string',
                textarea: true
              },
              lowPrice: {
                label: 'aposSeo:lowPrice',
                type: 'float',
                help: 'aposSeo:lowPriceHelp',
                required: true
              },
              highPrice: {
                label: 'aposSeo:highPrice',
                type: 'float',
                help: 'aposSeo:highPriceHelp',
                required: true
              },
              priceCurrency: {
                label: 'aposSeo:currency',
                type: 'string',
                def: 'USD',
                help: 'aposSeo:currencyHelp'
              },
              offerCount: {
                label: 'aposSeo:offerCount',
                type: 'integer',
                min: 1,
                help: 'aposSeo:offerCountHelp'
              },
              availability: {
                label: 'aposSeo:availability',
                type: 'select',
                def: 'InStock',
                choices: [
                  {
                    label: 'In Stock',
                    value: 'InStock'
                  },
                  {
                    label: 'Out of Stock',
                    value: 'OutOfStock'
                  },
                  {
                    label: 'Pre-order',
                    value: 'PreOrder'
                  },
                  {
                    label: 'Limited Availability',
                    value: 'LimitedAvailability'
                  }
                ]
              },
              seller: {
                label: 'aposSeo:seller',
                type: 'string',
                help: 'aposSeo:sellerHelp'
              },
              offers: {
                label: 'aposSeo:individualOffers',
                type: 'array',
                titleField: 'name',
                help: 'aposSeo:individualOffersHelp',
                fields: {
                  add: {
                    name: {
                      label: 'aposSeo:offerName',
                      type: 'string',
                      required: true
                    },
                    price: {
                      label: 'aposSeo:price',
                      type: 'float',
                      required: true
                    },
                    priceCurrency: {
                      label: 'aposSeo:currency',
                      type: 'string',
                      def: 'USD'
                    },
                    availability: {
                      label: 'aposSeo:availability',
                      type: 'select',
                      def: 'InStock',
                      choices: [
                        {
                          label: 'In Stock',
                          value: 'InStock'
                        },
                        {
                          label: 'Out of Stock',
                          value: 'OutOfStock'
                        },
                        {
                          label: 'Pre-order',
                          value: 'PreOrder'
                        }
                      ]
                    },
                    url: {
                      label: 'aposSeo:url',
                      type: 'url'
                    }
                  }
                }
              }
            }
          }
        }
      },
      group: {
        seo: {
          label: 'aposSeo:group',
          fields: [
            'seoTitle',
            'seoDescription',
            'seoRobots',
            'seoIsPaywalled',
            'seoPaywallSelector',
            'seoJsonLdType',
            'seoJsonLdProduct',
            'seoJsonLdEvent',
            'seoJsonLdPerson',
            'seoJsonLdBusiness',
            'seoJsonLdJobPosting',
            'seoJsonLdFAQ',
            'seoJsonLdVideo',
            'seoJsonLdHowTo',
            'seoJsonLdReview',
            'seoJsonLdRecipe',
            'seoJsonLdCourse',
            'seoIncludeItemList',
            'seoJsonLdOffer',
            'seoJsonLdAggregateOffer'
          ],
          last: true
        }
      }
    };
    // Canonical linking for pieces (if configured)
    if (self.options.seoCanonicalTypes &&
      Array.isArray(self.options.seoCanonicalTypes) &&
      self.options.seoCanonicalTypes.length) {

      const req = options.apos.task.getReq();
      const choices = [];
      configuration.add.seoSelectType = {
        type: 'select',
        label: req.t('aposSeo:canonicalSelectType'),
        choices,
        def: null
      };
      configuration.group.seo.fields.push('seoSelectType');

      self.options.seoCanonicalTypes.forEach(canonicalType => {
        const name = canonicalType.split(/^apostrophecms\/|apostrophecms-pro\//)[1] || canonicalType;
        const fieldName = `_${_.camelCase(`seoCanonical ${name}`)}`;
        const { label: moduleName = name } = options.apos.modules[canonicalType] || {};
        const label = req.t('aposSeo:canonicalModule', { type: _.startCase(req.t(moduleName)) });
        const help = req.t('aposSeo:canonicalModuleHelp', { type: _.lowerCase(self.__meta.name) });

        choices.push({
          label: _.startCase(req.t(moduleName)),
          value: fieldName
        });
        configuration.add[fieldName] = {
          help,
          label,
          max: 1,
          type: 'relationship',
          withType: canonicalType,
          builders: {
            project: {
              title: 1,
              slug: 1,
              _url: 1
            }
          },
          if: {
            seoSelectType: fieldName
          }
        };

        configuration.group.seo.fields.push(fieldName);
      });
    }

    return configuration;
  },
  methods(self) {
    return {
      getSchemaTypeChoices() {
        return [
          {
            label: 'None',
            value: ''
          },
          {
            label: 'Web Page',
            value: 'WebPage'
          },
          {
            label: 'Collection Page',
            value: 'CollectionPage'
          },
          {
            label: 'Article',
            value: 'Article'
          },
          {
            label: 'Blog Post',
            value: 'BlogPosting'
          },
          {
            label: 'Product',
            value: 'Product'
          },
          {
            label: 'Event',
            value: 'Event'
          },
          {
            label: 'Person',
            value: 'Person'
          },
          {
            label: 'Local Business',
            value: 'LocalBusiness'
          },
          {
            label: 'Job Posting',
            value: 'JobPosting'
          },
          {
            label: 'FAQ Page',
            value: 'FAQPage'
          },
          {
            label: 'Q&A Page',
            value: 'QAPage'
          },
          {
            label: 'Video',
            value: 'VideoObject'
          },
          {
            label: 'How-To',
            value: 'HowTo'
          },
          {
            label: 'Review',
            value: 'Review'
          },
          {
            label: 'Recipe',
            value: 'Recipe'
          },
          {
            label: 'Course',
            value: 'Course'
          },
          {
            label: 'Offer',
            value: 'Offer'
          },
          {
            label: 'Aggregate Offer',
            value: 'AggregateOffer'
          }
        ];
      }
    };
  }
};

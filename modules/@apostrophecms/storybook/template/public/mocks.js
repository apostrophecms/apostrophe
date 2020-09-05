(function() {
  // This code runs via a simple script tag, but you may assume
  // a modern browser because it runs only for our admin UI stories.
  apos.modules = {
    schema: {
      components: {
        fields: {
          area: 'AposInputArea',
          singleton: 'AposInputSingleton',
          string: 'AposInputString',
          slug: 'AposInputSlug',
          boolean: 'AposInputBoolean',
          checkboxes: 'AposInputCheckboxes',
          select: 'AposInputSelect',
          integer: 'AposInputInteger',
          float: 'AposInputFloat',
          color: 'AposInputColor',
          range: 'AposInputRange',
          url: 'AposInputUrl',
          date: 'AposInputDate',
          time: 'AposInputTime',
          password: 'AposInputPassword',
          group: 'AposInputGroup',
          array: 'AposInputArray',
          object: 'AposInputObject',
          relationshipByOne: 'AposInputRelationshipByOne',
          relationshipByOneReverse: 'AposInputRelationshipByOneReverse',
          relationshipByArray: 'AposInputRelationshipByArray',
          relationshipByArrayReverse: 'AposInputRelationshipByArrayReverse',
          attachment: 'AposInputAttachment',
          video: 'AposInputVideo'
        }
      },
      alias: 'schema'
    },
    products: {
      name: 'product',
      label: 'Product',
      pluralLabel: 'Products',
      action: '/api/v1/products',
      schema: [
        {
          type: 'string',
          name: 'title',
          label: 'Title',
          required: true,
          sortify: true,
          group: {
            name: 'basics',
            label: 'Basics'
          },
          _id: '1d809868eb5a6fe48c9c8e516a17072b'
        },
        {
          type: 'slug',
          name: 'slug',
          label: 'Slug',
          required: true,
          slugifies: 'title',
          group: {
            name: 'utility',
            label: 'Utility'
          },
          _id: '9a9f62aa7b35bdc4044b885d0806297e'
        },
        {
          type: 'boolean',
          name: 'published',
          label: 'Published',
          def: true,
          group: {
            name: 'utility',
            label: 'Utility'
          },
          _id: 'e146d8acff60cc41f257d010b61e277b'
        },
        {
          type: 'boolean',
          name: 'trash',
          label: 'Trash',
          contextual: true,
          def: false,
          group: {
            name: 'utility',
            label: 'Utility'
          },
          _id: '781f8a0089bef9e079178670f4a7efaa'
        },
        {
          name: 'price',
          type: 'string',
          group: {
            name: 'priceFields',
            label: 'Price Fields'
          },
          label: 'Price',
          _id: 'ab97e004c2d4457bb3034d03ef96689f'
        },
        {
          name: 'taxes',
          type: 'string',
          group: {
            name: 'priceFields',
            label: 'Price Fields'
          },
          label: 'Taxes',
          _id: 'cs12e00sc2d4457bb3034d03ef96689f'
        },
        {
          name: 'nonsense',
          type: 'select',
          label: 'Why is this field ungrouped?',
          _id: 'tcw0100sc2d4457bb3034d03ef96mc05',
          choices: [
            {
              value: 'confusion',
              label: 'Confusion'
            },
            {
              value: 'laziness',
              label: 'Laziness'
            },
            {
              value: 'cats',
              label: 'Interfering cats'
            }
          ]
        }
      ],
      filters: [
        {
          label: 'Published',
          name: 'published',
          choices: [
            {
              value: true,
              label: 'Published'
            },
            {
              value: false,
              label: 'Draft'
            },
            {
              value: null,
              label: 'Both'
            }
          ],
          allowedInChooser: false,
          def: true,
          inputType: 'radio'
        },
        {
          label: 'Trash',
          name: 'trash',
          choices: [
            {
              value: false,
              label: 'Live'
            },
            {
              value: true,
              label: 'Trash'
            }
          ],
          allowedInChooser: false,
          def: false,
          inputType: 'radio'
        }
      ],
      columns: [
        {
          name: 'title',
          label: 'Title'
        },
        {
          name: 'updatedAt',
          label: 'Last Updated'
        },
        {
          name: 'published',
          label: 'Published'
        }
      ],
      batchOperations: [
        {
          name: 'trash',
          label: 'Trash',
          unlessFilter: {
            trash: true
          }
        },
        {
          name: 'rescue',
          label: 'Rescue',
          unlessFilter: {
            trash: false
          }
        },
        {
          name: 'publish',
          label: 'Publish',
          unlessFilter: {
            published: true
          },
          requiredField: 'published'
        },
        {
          name: 'unpublish',
          label: 'Unpublish',
          unlessFilter: {
            published: false
          },
          requiredField: 'published'
        }
      ],
      components: {
        filters: 'ApostrophePiecesFilters',
        list: 'ApostrophePiecesList',
        pager: 'ApostrophePager',
        insertModal: 'AposDocEditor',
        managerModal: 'AposPiecesManager'
      }
    },
    '@apostrophecms/image': {
      name: '@apostrophecms/image',
      label: 'Image',
      pluralLabel: 'Images',
      action: '/api/v1/@apostrophecms/image',
      schema: [
        {
          type: 'attachment',
          name: 'attachment',
          label: 'Image File',
          fileGroup: 'images',
          required: true,
          group: {
            name: 'basics',
            label: 'Basics'
          },
          _id: 'ff809c0731221ac3fc49cee43bc1d96f'
        },
        {
          type: 'string',
          name: 'title',
          label: 'Title',
          required: true,
          sortify: true,
          group: {
            name: 'basics',
            label: 'Basics'
          },
          _id: '1d809868eb5a6fe48c9c8e516a17072b'
        },
        {
          type: 'slug',
          name: 'slug',
          label: 'Slug',
          prefix: 'image',
          required: true,
          group: {
            name: 'basics',
            label: 'Basics'
          },
          _id: '3e33d2f714881ce899c858791ef5eaf4'
        },
        {
          type: 'boolean',
          name: 'published',
          label: 'Published',
          def: true,
          group: {
            name: 'basics',
            label: 'Basics'
          },
          _id: 'e146d8acff60cc41f257d010b61e277b'
        },
        {
          type: 'relationship',
          name: '_tags',
          label: 'Tags',
          withType: '@apostrophecms/image-tag',
          group: {
            name: 'basics',
            label: 'Basics'
          },
          idsStorage: 'tagsIds',
          _id: '885071da9d576801a81f133f5c58b9a1'
        },
        {
          type: 'string',
          name: 'description',
          label: 'Description',
          textarea: true,
          group: {
            name: 'details',
            label: 'Details'
          },
          _id: '90e1312c2385c184e3b6f6e41fab3bc5'
        },
        {
          type: 'string',
          name: 'credit',
          label: 'Credit',
          group: {
            name: 'details',
            label: 'Details'
          },
          _id: 'dd38d1006aaffafce8eb6cd2c6b8aea6'
        },
        {
          type: 'url',
          name: 'creditUrl',
          label: 'Credit URL',
          group: {
            name: 'details',
            label: 'Details'
          },
          _id: '8adf70ca71d419bf473936061e54b7b0'
        },
        {
          type: 'boolean',
          name: 'trash',
          label: 'Trash',
          contextual: true,
          def: false,
          group: {
            name: 'ungrouped',
            label: 'Ungrouped'
          },
          _id: '781f8a0089bef9e079178670f4a7efaa'
        }
      ],
      filters: [
        {
          label: 'Published',
          name: 'published',
          choices: [
            {
              value: true,
              label: 'Published'
            },
            {
              value: false,
              label: 'Draft'
            },
            {
              value: null,
              label: 'Both'
            }
          ],
          allowedInChooser: false,
          def: true,
          style: 'pill'
        },
        {
          label: 'Trash',
          name: 'trash',
          choices: [
            {
              value: false,
              label: 'Live'
            },
            {
              value: true,
              label: 'Trash'
            }
          ],
          allowedInChooser: false,
          def: false,
          style: 'pill'
        }
      ],
      columns: [
        {
          name: 'title',
          label: 'Title'
        },
        {
          name: 'updatedAt',
          label: 'Edited on'
        },
        {
          name: 'published',
          label: 'Published'
        }
      ],
      batchOperations: [
        {
          name: 'trash',
          label: 'Trash',
          unlessFilter: {
            trash: true
          }
        },
        {
          name: 'rescue',
          label: 'Rescue',
          unlessFilter: {
            trash: false
          }
        },
        {
          name: 'publish',
          label: 'Publish',
          unlessFilter: {
            published: true
          },
          requiredField: 'published'
        },
        {
          name: 'unpublish',
          label: 'Unpublish',
          unlessFilter: {
            published: false
          },
          requiredField: 'published'
        }
      ],
      insertViaUpload: true,
      components: {
        filters: 'ApostrophePiecesFilters',
        list: 'ApostrophePiecesList',
        pager: 'ApostrophePager',
        insertModal: 'AposDocEditor',
        managerModal: 'AposMediaManager'
      },
      alias: 'image'
    },
    '@apostrophecms/attachment': {
      action: '/api/v1/@apostrophecms/attachment',
      fileGroups: [
        {
          name: 'images',
          label: 'Images',
          extensions: [
            'gif',
            'jpg',
            'png'
          ],
          extensionMaps: {
            jpeg: 'jpg'
          },
          image: true
        },
        {
          name: 'office',
          label: 'Office',
          extensions: [
            'txt',
            'rtf',
            'pdf',
            'xls',
            'ppt',
            'doc',
            'pptx',
            'sldx',
            'ppsx',
            'potx',
            'xlsx',
            'xltx',
            'csv',
            'docx',
            'dotx'
          ],
          extensionMaps: {},
          image: false
        }
      ],
      name: 'attachment',
      uploadsUrl: '/uploads',
      croppable: {
        gif: true,
        jpg: true,
        png: true
      },
      sized: {
        gif: true,
        jpg: true,
        png: true
      },
      alias: 'attachment'
    }
  };

  apos.http = {};

  const grape = {
    _id: 'ckcuoykl9000j38ecrjghrn0c',
    published: true,
    trash: false,
    type: 'product',
    title: 'Grape',
    slug: 'grape',
    price: '$100,000 AUD',
    taxes: '$42 AUD',
    metaType: 'doc',
    createdAt: '2020-07-22T02:11:19.005Z',
    titleSortified: 'grape',
    updatedAt: '2020-07-22T02:11:19.005Z',
    highSearchText: 'grape grape',
    highSearchWords: [
      'grape'
    ],
    lowSearchText: 'grape grape',
    searchSummary: '',
    docPermissions: [],
    _edit: true
  };

  const strawberry = {
    _id: 'htcuoykl9012j38ecrjghrn0c',
    published: true,
    trash: false,
    type: 'product',
    title: 'Strawberry',
    slug: 'strawberry',
    price: '$100,000 USD',
    taxes: '$42 USD',
    metaType: 'doc',
    createdAt: '2020-07-20T15:56:19.005Z',
    titleSortified: 'strawberry',
    updatedAt: '2020-07-20T15:56:19.005Z',
    highSearchText: 'strawberry strawberry',
    highSearchWords: [
      'strawberry'
    ],
    lowSearchText: 'strawberry strawberry',
    searchSummary: '',
    docPermissions: [],
    _edit: true
  };

  apos.http.getResponses = {
    '/api/v1/products?published=true&trash=false&page=1': {
      pages: 1,
      currentPage: 1,
      results: [
        grape,
        strawberry
      ]
    },
    [`/api/v1/products/${grape._id}`]: grape,
    [`/api/v1/products/${strawberry._id}`]: strawberry,
    '/api/v1/@apostrophecms/page?all=1': {
      results: {
        title: 'Home',
        slug: '/',
        _id: 'ckd4y2m7j00074k9kbrxs0bat',
        type: '@apostrophecms/home-page',
        metaType: 'doc',
        _url: '/',
        _children: [ {
          title: 'Pellentesque Nullam Purus',
          slug: '/second',
          _id: 'ckd96fndy0004fo9kbusxz2kf',
          type: '@apostrophecms/home-page',
          metaType: 'doc',
          _url: '/second',
          _children: [],
          published: true,
          updatedAt: '2020-07-29T19:14:15.719Z'
        }, {
          title: 'Sem Pellentesque Etiam Bibendum Porta',
          slug: '/third',
          _id: 'ckd96fneg0007fo9k6adjs0o9',
          type: '@apostrophecms/home-page',
          metaType: 'doc',
          _url: '/third',
          _children: [],
          published: false,
          updatedAt: '2020-07-30T19:14:15.737Z'
        }, {
          title: 'Elit Parturient Euismod',
          slug: '/third/fourth',
          _id: 'ckd96fneu000afo9k53bzhvah',
          type: '@apostrophecms/home-page',
          metaType: 'doc',
          _url: '/third/fourth',
          _children: [],
          published: true,
          updatedAt: '2020-07-30T19:14:15.750Z'
        } ],
        published: true,
        updatedAt: '2020-07-27T20:09:06.031Z'
      }
    }
  };

  apos.http.postResponses = {};

  // Adds query string data to url. Currently supports only one level
  // of parameters (not nested structures)
  apos.http.addQueryToUrl = function(url, data) {
    let keys;
    let i;
    if ((data !== null) && ((typeof data) === 'object')) {
      keys = Object.keys(data);
      for (i = 0; (i < keys.length); i++) {
        const key = keys[i];
        if (i > 0) {
          url += '&';
        } else {
          url += '?';
        }
        url += encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
      }
    }
    return url;
  };

  apos.http.postResponses = {
    '/api/v1/products': {
      status: 200
    },
    '/api/v1/image-upload-mock': {
      status: 200
    }
  };

  apos.http.putResponses = {
    '/api/v1/products': {
      status: 200
    }
  };

  apos.http.get = async (url, options) => {
    // variable async delay for realism
    await delay(Math.random() * 100 + 100);
    if (options.qs.search || options.qs.search === '') {
      console.info(`Mock searching for ${options.qs.search}...`);
      delete options.qs.search;
    }
    if (options.qs) {
      url = apos.http.addQueryToUrl(url, options.qs);
    }
    if (apos.http.getResponses[url]) {
      // Like responses from a real API, the returned object needs to be safe to
      // change.
      return JSON.parse(JSON.stringify(apos.http.getResponses[url]));
    } else {
      throw {
        status: 404
      };
    }
  };

  apos.http.post = async (url, options) => {
    // variable async delay for realism
    await delay(Math.random() * 100 + 100);
    if (options.qs) {
      url = apos.http.addQueryToUrl(url, options.qs);
    }
    if (apos.http.postResponses[url]) {
      // Like responses from a real API, the returned object needs to be safe to
      // change.
      return JSON.parse(JSON.stringify(apos.http.postResponses[url]));
    } else {
      throw {
        status: 404
      };
    }
  };

  apos.http.put = async (url, options) => {
    // variable async delay for realism
    await delay(Math.random() * 100 + 100);
    if (options.qs) {
      url = apos.http.addQueryToUrl(url, options.qs);
    }
    if (apos.http.putResponses[url]) {
      // Like responses from a real API, the returned object needs to be safe to
      // change.
      return JSON.parse(JSON.stringify(apos.http.postResponses[url]));
    } else {
      throw {
        status: 404
      };
    }
  };

  function delay(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, ms);
    });
  }

})();

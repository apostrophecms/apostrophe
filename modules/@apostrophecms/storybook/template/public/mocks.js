(function() {
  // This code runs via a simple script tag, but you may assume
  // a modern browser because it runs only for our admin UI stories.
  apos.modules = {
    schema: {
      'components': {
        'fields': {
          'area': 'AposInputArea',
          'singleton': 'AposInputSingleton',
          'string': 'AposInputString',
          'slug': 'AposInputSlug',
          'boolean': 'AposInputBoolean',
          'checkboxes': 'AposInputCheckboxes',
          'select': 'AposInputSelect',
          'integer': 'AposInputInteger',
          'float': 'AposInputFloat',
          'color': 'AposInputColor',
          'range': 'AposInputRange',
          'url': 'AposInputUrl',
          'date': 'AposInputDate',
          'time': 'AposInputTime',
          'password': 'AposInputPassword',
          'group': 'AposInputGroup',
          'array': 'AposInputArray',
          'object': 'AposInputObject',
          'joinByOne': 'AposInputJoinByOne',
          'joinByOneReverse': 'AposInputJoinByOneReverse',
          'joinByArray': 'AposInputJoinByArray',
          'joinByArrayReverse': 'AposInputJoinByArrayReverse',
          'attachment': 'AposInputAttachment',
          'video': 'AposInputVideo'
        }
      },
      'alias': 'schema'
    },
    products: {
      'name': 'product',
      'label': 'Product',
      'pluralLabel': 'Products',
      'action': '/api/v1/products',
      'schema': [
        {
          'type': 'string',
          'name': 'title',
          'label': 'Title',
          'required': true,
          'sortify': true,
          'group': {
            'name': 'basics',
            'label': 'Basics'
          },
          '_id': '1d809868eb5a6fe48c9c8e516a17072b'
        },
        {
          'type': 'slug',
          'name': 'slug',
          'label': 'Slug',
          'required': true,
          'slugifies': 'title',
          'group': {
            'name': 'basics',
            'label': 'Basics'
          },
          '_id': '9a9f62aa7b35bdc4044b885d0806297e'
        },
        {
          'type': 'boolean',
          'name': 'published',
          'label': 'Published',
          'def': true,
          'group': {
            'name': 'basics',
            'label': 'Basics'
          },
          '_id': 'e146d8acff60cc41f257d010b61e277b'
        },
        {
          'type': 'boolean',
          'name': 'trash',
          'label': 'Trash',
          'contextual': true,
          'def': false,
          'group': {
            'name': 'default',
            'label': 'Info'
          },
          '_id': '781f8a0089bef9e079178670f4a7efaa'
        },
        {
          'name': 'price',
          'type': 'string',
          'group': {
            'name': 'default',
            'label': 'Info'
          },
          'label': 'Price',
          '_id': 'ab97e004c2d4457bb3034d03ef96689f'
        }
      ],
      'filters': [
        {
          'name': 'published',
          'choices': [
            {
              'value': true,
              'label': 'Published'
            },
            {
              'value': false,
              'label': 'Draft'
            },
            {
              'value': null,
              'label': 'Both'
            }
          ],
          'allowedInChooser': false,
          'def': true,
          'style': 'pill'
        },
        {
          'name': 'trash',
          'choices': [
            {
              'value': false,
              'label': 'Live'
            },
            {
              'value': true,
              'label': 'Trash'
            }
          ],
          'allowedInChooser': false,
          'def': false,
          'style': 'pill'
        }
      ],
      'columns': [
        {
          'name': 'title',
          'label': 'Title'
        },
        {
          'name': 'updatedAt',
          'label': 'Last Updated'
        },
        {
          'name': 'published',
          'label': 'Published'
        }
      ],
      'batchOperations': [
        {
          'name': 'trash',
          'label': 'Trash',
          'unlessFilter': {
            'trash': true
          }
        },
        {
          'name': 'rescue',
          'label': 'Rescue',
          'unlessFilter': {
            'trash': false
          }
        },
        {
          'name': 'publish',
          'label': 'Publish',
          'unlessFilter': {
            'published': true
          },
          'requiredField': 'published'
        },
        {
          'name': 'unpublish',
          'label': 'Unpublish',
          'unlessFilter': {
            'published': false
          },
          'requiredField': 'published'
        }
      ],
      'components': {
        'filters': 'ApostrophePiecesFilters',
        'list': 'ApostrophePiecesList',
        'pager': 'ApostrophePager',
        'insertModal': 'ApostrophePiecesInsertModal',
        'managerModal': 'AposPiecesManager'
      }
    }
  };

  apos.http = {};

  apos.http.getResponses = {
    '/api/v1/products?published=true&trash=false&page=1': {
      'pages': 1,
      'currentPage': 1,
      'results': [
        {
          '_id': 'ckcuoykl9000j38ecrjghrn0c',
          'published': true,
          'trash': false,
          'type': 'product',
          'title': 'cool',
          'slug': 'cool',
          'price': null,
          'metaType': 'doc',
          'createdAt': '2020-07-20T15:56:19.005Z',
          'titleSortified': 'cool',
          'updatedAt': '2020-07-20T15:56:19.005Z',
          'highSearchText': 'cool cool',
          'highSearchWords': [
            'cool'
          ],
          'lowSearchText': 'cool cool',
          'searchSummary': '',
          'docPermissions': [],
          '_edit': true
        }
      ]
    },
    '/api/v1/@apostrophecms/page?all=1': {
      'results': {
        'title': 'Home',
        'slug': '/',
        '_id': 'ckd4y2m7j00074k9kbrxs0bat',
        'type': '@apostrophecms/home-page',
        'metaType': 'doc',
        '_url': '/',
        '_children': [{
          'title': 'Pellentesque Nullam Purus',
          'slug': '/second',
          '_id': 'ckd96fndy0004fo9kbusxz2kf',
          'type': '@apostrophecms/home-page',
          'metaType': 'doc',
          '_url': '/second',
          '_children': [],
          'published': true,
          'updatedAt': '2020-07-29T19:14:15.719Z'
        }, {
          'title': 'Sem Pellentesque Etiam Bibendum Porta',
          'slug': '/third',
          '_id': 'ckd96fneg0007fo9k6adjs0o9',
          'type': '@apostrophecms/home-page',
          'metaType': 'doc',
          '_url': '/third',
          '_children': [],
          'published': false,
          'updatedAt': '2020-07-30T19:14:15.737Z'
        }, {
          'title': 'Elit Parturient Euismod',
          'slug': '/third/fourth',
          '_id': 'ckd96fneu000afo9k53bzhvah',
          'type': '@apostrophecms/home-page',
          'metaType': 'doc',
          '_url': '/third/fourth',
          '_children': [],
          'published': true,
          'updatedAt': '2020-07-30T19:14:15.750Z'
        }],
        'published': true,
        'updatedAt': '2020-07-27T20:09:06.031Z'
      }
    }
  };

  // Adds query string data to url. Currently supports only one level
  // of parameters (not nested structures)
  apos.http.addQueryToUrl = function(url, data) {
    let keys;
    let i;
    if ((data !== null) && ((typeof data) === 'object')) {
      keys = Object.keys(data);
      for (i = 0; (i < keys.length); i++) {
        let key = keys[i];
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

  apos.http.get = async (url, options) => {
    // variable async delay for realism
    await delay(Math.random() * 100 + 100);
    if (options.qs) {
      url = apos.http.addQueryToUrl(url, options.qs);
    }
    if (apos.http.getResponses[url]) {
      return apos.http.getResponses[url];
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

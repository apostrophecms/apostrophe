(function() {
  // This code runs via a simple script tag, but you may assume
  // a modern browser because it runs only for our admin UI stories.
  apos.modules = {
    products: {
      "name": "product",
      "label": "Product",
      "pluralLabel": "Products",
      "action": "/api/v1/products",
      "schema": [
        {
          "type": "string",
          "name": "title",
          "label": "Title",
          "required": true,
          "sortify": true,
          "group": {
            "name": "basics",
            "label": "Basics"
          },
          "_id": "1d809868eb5a6fe48c9c8e516a17072b"
        },
        {
          "type": "slug",
          "name": "slug",
          "label": "Slug",
          "required": true,
          "slugifies": "title",
          "group": {
            "name": "basics",
            "label": "Basics"
          },
          "_id": "9a9f62aa7b35bdc4044b885d0806297e"
        },
        {
          "type": "boolean",
          "name": "published",
          "label": "Published",
          "def": true,
          "group": {
            "name": "basics",
            "label": "Basics"
          },
          "_id": "e146d8acff60cc41f257d010b61e277b"
        },
        {
          "type": "boolean",
          "name": "trash",
          "label": "Trash",
          "contextual": true,
          "def": false,
          "group": {
            "name": "default",
            "label": "Info"
          },
          "_id": "781f8a0089bef9e079178670f4a7efaa"
        },
        {
          "name": "price",
          "type": "string",
          "group": {
            "name": "default",
            "label": "Info"
          },
          "label": "Price",
          "_id": "ab97e004c2d4457bb3034d03ef96689f"
        }
      ],
      "filters": [
        {
          "name": "published",
          "choices": [
            {
              "value": true,
              "label": "Published"
            },
            {
              "value": false,
              "label": "Draft"
            },
            {
              "value": null,
              "label": "Both"
            }
          ],
          "allowedInChooser": false,
          "def": true,
          "style": "pill"
        },
        {
          "name": "trash",
          "choices": [
            {
              "value": false,
              "label": "Live"
            },
            {
              "value": true,
              "label": "Trash"
            }
          ],
          "allowedInChooser": false,
          "def": false,
          "style": "pill"
        }
      ],
      "columns": [
        {
          "name": "title",
          "label": "Title"
        },
        {
          "name": "updatedAt",
          "label": "Last Updated"
        },
        {
          "name": "published",
          "label": "Published"
        }
      ],
      "batchOperations": [
        {
          "name": "trash",
          "label": "Trash",
          "unlessFilter": {
            "trash": true
          }
        },
        {
          "name": "rescue",
          "label": "Rescue",
          "unlessFilter": {
            "trash": false
          }
        },
        {
          "name": "publish",
          "label": "Publish",
          "unlessFilter": {
            "published": true
          },
          "requiredField": "published"
        },
        {
          "name": "unpublish",
          "label": "Unpublish",
          "unlessFilter": {
            "published": false
          },
          "requiredField": "published"
        }
      ],
      "components": {
        "filters": "ApostrophePiecesFilters",
        "list": "ApostrophePiecesList",
        "pager": "ApostrophePager",
        "insertModal": "ApostrophePiecesInsertModal",
        "managerModal": "AposPiecesManager"
      }
    }
  };

  apos.http.getResponses = {
    '/api/v1/products?published=true&trash=false&page=1': {
      "pages": 1,
      "currentPage": 1,
      "results": [
        {
          "_id": "ckcuoykl9000j38ecrjghrn0c",
          "published": true,
          "trash": false,
          "type": "product",
          "title": "cool",
          "slug": "cool",
          "price": null,
          "metaType": "doc",
          "createdAt": "2020-07-20T15:56:19.005Z",
          "titleSortified": "cool",
          "updatedAt": "2020-07-20T15:56:19.005Z",
          "highSearchText": "cool cool",
          "highSearchWords": [
            "cool"
          ],
          "lowSearchText": "cool cool",
          "searchSummary": "",
          "docPermissions": [],
          "_edit": true
        }
      ]
    }
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

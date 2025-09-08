# PagesApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**pageArchive**](#pagearchive) | **POST** /@apostrophecms/page/archive | Archive pages|
|[**pageDeleteById**](#pagedeletebyid) | **DELETE** /@apostrophecms/page/{_id} | Delete page|
|[**pageDismissSubmissionById**](#pagedismisssubmissionbyid) | **POST** /@apostrophecms/page/{_id}/dismiss-submission | Dismiss page submission|
|[**pageGet**](#pageget) | **GET** /@apostrophecms/page | Get page tree|
|[**pageGetById**](#pagegetbyid) | **GET** /@apostrophecms/page/{_id} | Get page by ID|
|[**pageGetLocaleById**](#pagegetlocalebyid) | **GET** /@apostrophecms/page/{_id}/locale/{toLocale} | Get page in specific locale|
|[**pageGetLocalesById**](#pagegetlocalesbyid) | **GET** /@apostrophecms/page/{_id}/locales | Get page locales|
|[**pageLocalize**](#pagelocalize) | **POST** /@apostrophecms/page/localize | Localize pages|
|[**pageLocalizeById**](#pagelocalizebyid) | **POST** /@apostrophecms/page/{_id}/localize | Localize page|
|[**pagePatchById**](#pagepatchbyid) | **PATCH** /@apostrophecms/page/{_id} | Update page|
|[**pagePost**](#pagepost) | **POST** /@apostrophecms/page | Create new page|
|[**pagePublish**](#pagepublish) | **POST** /@apostrophecms/page/publish | Publish pages|
|[**pagePublishById**](#pagepublishbyid) | **POST** /@apostrophecms/page/{_id}/publish | Publish page|
|[**pagePutById**](#pageputbyid) | **PUT** /@apostrophecms/page/{_id} | Replace page|
|[**pageRestore**](#pagerestore) | **POST** /@apostrophecms/page/restore | Restore pages|
|[**pageRevertDraftToPublishedById**](#pagerevertdrafttopublishedbyid) | **POST** /@apostrophecms/page/{_id}/revert-draft-to-published | Revert draft to published|
|[**pageRevertPublishedToPreviousById**](#pagerevertpublishedtopreviousbyid) | **POST** /@apostrophecms/page/{_id}/revert-published-to-previous | Revert published to previous|
|[**pageShareById**](#pagesharebyid) | **POST** /@apostrophecms/page/{_id}/share | Share page|
|[**pageSubmitById**](#pagesubmitbyid) | **POST** /@apostrophecms/page/{_id}/submit | Submit page|
|[**pageUnpublishById**](#pageunpublishbyid) | **POST** /@apostrophecms/page/{_id}/unpublish | Unpublish page|

# **pageArchive**
> PageArchive200Response pageArchive(pageArchiveRequest)

Archive pages in bulk, making them inactive while preserving their data in the page tree

### Example

```typescript
import {
    PagesApi,
    Configuration,
    PageArchiveRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let pageArchiveRequest: PageArchiveRequest; //

const { status, data } = await apiInstance.pageArchive(
    pageArchiveRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pageArchiveRequest** | **PageArchiveRequest**|  | |


### Return type

**PageArchive200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Archive job started successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageDeleteById**
> Page pageDeleteById()

⚠️ **Permanently delete a page document.** This cannot be undone.  **Important**: This endpoint should be used to delete the draft version of a page. If the page has been published, you should unpublish it first using the unpublish endpoint to ensure complete removal.  **Recommended deletion workflow**: 1. Unpublish the page (removes published version) 2. Delete the page (removes draft version)  **Restrictions:** - Cannot delete home page - Cannot delete pages with children (delete children first) - Cannot delete draft if published version exists ⚠️ **Permanently delete a page document.** This cannot be undone.  **Use with caution!** 

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.pageDeleteById(
    id,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page deleted successfully |  -  |
|**400** | Deletion not allowed |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageDismissSubmissionById**
> Page pageDismissSubmissionById()

Dismiss a pending submission for the specified page, removing it from the review queue

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.pageDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageGet**
> PageGet200Response pageGet()

🚀 **Essential for headless sites!** Fetch your site\'s complete page structure and content.  **Perfect for:** - Building navigation menus - Getting all pages for static site generation - Fetching content for SPA routing - Understanding your site structure  Returns the complete page hierarchy starting from the home page. Use `flat=1` to get pages in a flat array instead of nested structure. 

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let all: '1'; //Include entire page tree regardless of depth (use with caution for large sites) (optional) (default to undefined)
let flat: '1'; //💡 Return pages in flat array instead of tree structure - easier for some use cases (optional) (default to undefined)
let children: 'false'; //Include children array in response (set to \'false\' to exclude) (optional) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.pageGet(
    all,
    flat,
    children,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **all** | [**&#39;1&#39;**]**Array<&#39;1&#39;>** | Include entire page tree regardless of depth (use with caution for large sites) | (optional) defaults to undefined|
| **flat** | [**&#39;1&#39;**]**Array<&#39;1&#39;>** | 💡 Return pages in flat array instead of tree structure - easier for some use cases | (optional) defaults to undefined|
| **children** | [**&#39;false&#39;**]**Array<&#39;false&#39;>** | Include children array in response (set to \&#39;false\&#39; to exclude) | (optional) defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**PageGet200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page tree retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageGetById**
> Page pageGetById()

Fetch a single page document by ID for detailed content access.  **Perfect for:** - Getting page content for rendering - Fetching specific page data - Building page detail views  The ID can include mode and locale (e.g., `id:en:published`) or use query parameters to specify them. 

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.pageGetById(
    id,
    aposMode,
    aposLocale,
    renderAreas
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|
| **renderAreas** | [**boolean**] | 💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures | (optional) defaults to false|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageGetLocaleById**
> Page pageGetLocaleById()

Retrieve the specified page in a specific locale

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.pageGetLocaleById(
    id,
    toLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **toLocale** | [**string**] | Target locale code (e.g., en:us:published) | defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageGetLocalesById**
> PageGetLocalesById200Response pageGetLocalesById()

Retrieve all available locales for the specified page

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.pageGetLocalesById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**PageGetLocalesById200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageLocalize**
> Array<Page> pageLocalize(pageLocalizeRequest)

Create or update localized versions of pages in bulk for different languages/regions

### Example

```typescript
import {
    PagesApi,
    Configuration,
    PageLocalizeRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let pageLocalizeRequest: PageLocalizeRequest; //

const { status, data } = await apiInstance.pageLocalize(
    pageLocalizeRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pageLocalizeRequest** | **PageLocalizeRequest**|  | |


### Return type

**Array<Page>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Pages localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageLocalizeById**
> Page pageLocalizeById(pageLocalizeByIdRequest)

Create a localized version of the specified page for a specific language/region

### Example

```typescript
import {
    PagesApi,
    Configuration,
    PageLocalizeByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let pageLocalizeByIdRequest: PageLocalizeByIdRequest; //

const { status, data } = await apiInstance.pageLocalizeById(
    id,
    pageLocalizeByIdRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pageLocalizeByIdRequest** | **PageLocalizeByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pagePatchById**
> Page pagePatchById(pagePatchByIdRequest)

Partially update a page document.  **Perfect for:** - Updating page titles or content - Moving pages within the tree - Making incremental changes  Can use MongoDB-style operators and dot notation for nested properties. Include `_targetId` and `_position` to move the page within the tree. 

### Example

```typescript
import {
    PagesApi,
    Configuration,
    PagePatchByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let pagePatchByIdRequest: PagePatchByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.pagePatchById(
    id,
    pagePatchByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pagePatchByIdRequest** | **PagePatchByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pagePost**
> Page pagePost(pageCreateRequest)

Insert a new page at the specified position in the page tree.  **Perfect for:** - Programmatically creating pages - Building page management interfaces - Migrating content from other systems  Requires `_targetId` and `_position` to determine placement in the page tree. 

### Example

```typescript
import {
    PagesApi,
    Configuration,
    PageCreateRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let pageCreateRequest: PageCreateRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.pagePost(
    pageCreateRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pageCreateRequest** | **PageCreateRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page created successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pagePublish**
> Array<Page> pagePublish(pagePublishRequest)

Publish pages in bulk, making them live and visible to end users in the page tree

### Example

```typescript
import {
    PagesApi,
    Configuration,
    PagePublishRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let pagePublishRequest: PagePublishRequest; //

const { status, data } = await apiInstance.pagePublish(
    pagePublishRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pagePublishRequest** | **PagePublishRequest**|  | |


### Return type

**Array<Page>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Pages published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pagePublishById**
> Page pagePublishById()

**Advanced Feature**: Publish a draft page to make it live.  Moves a page from draft mode to published mode, making it visible to public users. Essential for content workflows where editors create drafts before publishing.  **Use cases:** - Content approval workflows - Scheduled publishing systems - Editorial review processes  The `_id` can be from either the draft or published version,  or you can use the `aposDocId` to reference the document. 

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.pagePublishById(
    id,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page published successfully |  -  |
|**400** | Bad request - cannot publish (e.g., validation errors) |  -  |
|**401** | Authentication required |  -  |
|**403** | Forbidden - insufficient permissions to publish pages |  -  |
|**404** | Page not found or no draft version exists |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pagePutById**
> Page pagePutById(pagePutByIdRequest)

Completely replace a page document.  **Use cases:** - Complete page updates - Moving pages in the tree structure - Replacing page content entirely  Requires `_targetId` and `_position` for page tree positioning. 

### Example

```typescript
import {
    PagesApi,
    Configuration,
    PagePutByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let pagePutByIdRequest: PagePutByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.pagePutById(
    id,
    pagePutByIdRequest,
    aposMode,
    aposLocale,
    renderAreas
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pagePutByIdRequest** | **PagePutByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|
| **renderAreas** | [**boolean**] | 💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures | (optional) defaults to false|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageRestore**
> Array<Page> pageRestore(bulkOperationRequest)

Restore previously archived pages in bulk, making them active again in the page tree

### Example

```typescript
import {
    PagesApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.pageRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Array<Page>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Pages restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageRevertDraftToPublishedById**
> Page pageRevertDraftToPublishedById()

Revert the draft version of the specified page back to its published state

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.pageRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageRevertPublishedToPreviousById**
> Page pageRevertPublishedToPreviousById()

Revert the published version of the specified page to its previous published state

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.pageRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageShareById**
> Page pageShareById()

Generate a sharing link or configure sharing permissions for the specified page

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.pageShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageSubmitById**
> Page pageSubmitById()

Submit the specified page for review and approval workflow

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.pageSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pageUnpublishById**
> Page pageUnpublishById()

Unpublish the specified page, removing it from public visibility while preserving the content

### Example

```typescript
import {
    PagesApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new PagesApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.pageUnpublishById(
    id,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Page**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Page unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


# GlobalContentApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**globalArchive**](#globalarchive) | **POST** /@apostrophecms/global/archive | Archive global document|
|[**globalDeleteById**](#globaldeletebyid) | **DELETE** /@apostrophecms/global/{_id} | Delete global document|
|[**globalDismissSubmissionById**](#globaldismisssubmissionbyid) | **POST** /@apostrophecms/global/{_id}/dismiss-submission | Dismiss global submission|
|[**globalGet**](#globalget) | **GET** /@apostrophecms/global | Get global content|
|[**globalGetById**](#globalgetbyid) | **GET** /@apostrophecms/global/{_id} | Get global document|
|[**globalGetLocaleById**](#globalgetlocalebyid) | **GET** /@apostrophecms/global/{_id}/locale/{toLocale} | Get global document locale|
|[**globalGetLocalesById**](#globalgetlocalesbyid) | **GET** /@apostrophecms/global/{_id}/locales | Get global document locales|
|[**globalLocalize**](#globallocalize) | **POST** /@apostrophecms/global/localize | Localize global document|
|[**globalLocalizeById**](#globallocalizebyid) | **POST** /@apostrophecms/global/{_id}/localize | Localize global document|
|[**globalPatchById**](#globalpatchbyid) | **PATCH** /@apostrophecms/global/{_id} | Update global document|
|[**globalPost**](#globalpost) | **POST** /@apostrophecms/global | Update global content|
|[**globalPublish**](#globalpublish) | **POST** /@apostrophecms/global/publish | Publish global document|
|[**globalPublishById**](#globalpublishbyid) | **POST** /@apostrophecms/global/{_id}/publish | Publish global document|
|[**globalPutById**](#globalputbyid) | **PUT** /@apostrophecms/global/{_id} | Replace global document|
|[**globalRestore**](#globalrestore) | **POST** /@apostrophecms/global/restore | Restore global document|
|[**globalRevertDraftToPublishedById**](#globalrevertdrafttopublishedbyid) | **POST** /@apostrophecms/global/{_id}/revert-draft-to-published | Revert draft to published|
|[**globalRevertPublishedToPreviousById**](#globalrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/global/{_id}/revert-published-to-previous | Revert published to previous|
|[**globalShareById**](#globalsharebyid) | **POST** /@apostrophecms/global/{_id}/share | Share global document|
|[**globalSubmitById**](#globalsubmitbyid) | **POST** /@apostrophecms/global/{_id}/submit | Submit global document|
|[**globalUnpublishById**](#globalunpublishbyid) | **POST** /@apostrophecms/global/{_id}/unpublish | Unpublish global document|

# **globalArchive**
> PageArchive200Response globalArchive(bulkOperationRequest)

Archive the global document, making it inactive while preserving its data

### Example

```typescript
import {
    GlobalContentApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.globalArchive(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


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

# **globalDeleteById**
> Global globalDeleteById()

Permanently delete a specific global document by ID (requires appropriate permissions)

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalDeleteById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global deleted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalDismissSubmissionById**
> Global globalDismissSubmissionById()

Dismiss a pending submission for the specified global document, removing it from the review queue

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalGet**
> GlobalGet200Response globalGet()

Retrieve global site configuration and content that appears across all pages

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.globalGet(
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**GlobalGet200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful response |  -  |
|**401** | Authentication required |  -  |
|**404** | Resource not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalGetById**
> Global globalGetById()

Retrieve a specific global document by ID (requires appropriate permissions)

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalGetById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalGetLocaleById**
> Global globalGetLocaleById()

Retrieve the specified global document in a specific locale

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.globalGetLocaleById(
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

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalGetLocalesById**
> Array<string> globalGetLocalesById()

Retrieve all available locales for the specified global document

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalGetLocalesById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Array<string>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalLocalize**
> Global globalLocalize()

Create or update localized versions of the global document for different languages/regions

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

const { status, data } = await apiInstance.globalLocalize();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalLocalizeById**
> Global globalLocalizeById()

Create a localized version of the specified global document for a specific language/region

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalLocalizeById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalPatchById**
> Global globalPatchById(globalPatch)

Partially update a specific global document by ID using PATCH semantics. Writes must target the draft mode. 

### Example

```typescript
import {
    GlobalContentApi,
    Configuration,
    GlobalPatch
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let globalPatch: GlobalPatch; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.globalPatchById(
    id,
    globalPatch,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **globalPatch** | **GlobalPatch**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalPost**
> Global globalPost(globalPostRequest)

Update global site configuration and content (requires editor permissions or higher)

### Example

```typescript
import {
    GlobalContentApi,
    Configuration,
    GlobalPostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let globalPostRequest: GlobalPostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.globalPost(
    globalPostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **globalPostRequest** | **GlobalPostRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global content updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalPublish**
> Global globalPublish()

Publish the global document, making it live and visible to end users

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

const { status, data } = await apiInstance.globalPublish();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalPublishById**
> Global globalPublishById()

Publish the specified global document, making it live and visible to end users

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalPublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalPutById**
> Global globalPutById()

Completely replace a specific global document by ID using PUT semantics

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalPutById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalRestore**
> Global globalRestore(bulkOperationRequest)

Restore a previously archived global document, making it active again

### Example

```typescript
import {
    GlobalContentApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.globalRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalRevertDraftToPublishedById**
> Global globalRevertDraftToPublishedById()

Revert the draft version of the specified global document back to its published state

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalRevertPublishedToPreviousById**
> Global globalRevertPublishedToPreviousById()

Revert the published version of the specified global document to its previous published state

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalShareById**
> Global globalShareById()

Generate a sharing link or configure sharing permissions for the specified global document

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalSubmitById**
> Global globalSubmitById()

Submit the specified global document for review and approval workflow

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **globalUnpublishById**
> Global globalUnpublishById()

Unpublish the specified global document, removing it from public visibility while preserving the content

### Example

```typescript
import {
    GlobalContentApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new GlobalContentApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.globalUnpublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Global**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Global unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


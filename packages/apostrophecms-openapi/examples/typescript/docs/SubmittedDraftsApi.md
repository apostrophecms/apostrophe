# SubmittedDraftsApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**submittedDraftArchive**](#submitteddraftarchive) | **POST** /@apostrophecms/submitted-draft/archive | Archive submitted drafts|
|[**submittedDraftDeleteById**](#submitteddraftdeletebyid) | **DELETE** /@apostrophecms/submitted-draft/{_id} | Delete submitted draft|
|[**submittedDraftDismissSubmissionById**](#submitteddraftdismisssubmissionbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/dismiss-submission | Dismiss submission|
|[**submittedDraftGet**](#submitteddraftget) | **GET** /@apostrophecms/submitted-draft | List submitted drafts|
|[**submittedDraftGetById**](#submitteddraftgetbyid) | **GET** /@apostrophecms/submitted-draft/{_id} | Get submitted draft|
|[**submittedDraftGetLocaleById**](#submitteddraftgetlocalebyid) | **GET** /@apostrophecms/submitted-draft/{_id}/locale/{toLocale} | Get submitted draft locale|
|[**submittedDraftGetLocalesById**](#submitteddraftgetlocalesbyid) | **GET** /@apostrophecms/submitted-draft/{_id}/locales | Get submitted draft locales|
|[**submittedDraftLocalize**](#submitteddraftlocalize) | **POST** /@apostrophecms/submitted-draft/localize | Localize submitted drafts|
|[**submittedDraftLocalizeById**](#submitteddraftlocalizebyid) | **POST** /@apostrophecms/submitted-draft/{_id}/localize | Localize submitted draft|
|[**submittedDraftPatchById**](#submitteddraftpatchbyid) | **PATCH** /@apostrophecms/submitted-draft/{_id} | Update submitted draft|
|[**submittedDraftPost**](#submitteddraftpost) | **POST** /@apostrophecms/submitted-draft | Create submitted draft|
|[**submittedDraftPublish**](#submitteddraftpublish) | **POST** /@apostrophecms/submitted-draft/publish | Publish submitted drafts|
|[**submittedDraftPublishById**](#submitteddraftpublishbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/publish | Publish submitted draft|
|[**submittedDraftPutById**](#submitteddraftputbyid) | **PUT** /@apostrophecms/submitted-draft/{_id} | Replace submitted draft|
|[**submittedDraftRestore**](#submitteddraftrestore) | **POST** /@apostrophecms/submitted-draft/restore | Restore submitted drafts|
|[**submittedDraftRevertDraftToPublishedById**](#submitteddraftrevertdrafttopublishedbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/revert-draft-to-published | Revert draft to published|
|[**submittedDraftRevertPublishedToPreviousById**](#submitteddraftrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/revert-published-to-previous | Revert published to previous|
|[**submittedDraftShareById**](#submitteddraftsharebyid) | **POST** /@apostrophecms/submitted-draft/{_id}/share | Share submitted draft|
|[**submittedDraftSubmitById**](#submitteddraftsubmitbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/submit | Submit draft|
|[**submittedDraftUnpublishById**](#submitteddraftunpublishbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/unpublish | Unpublish submitted draft|

# **submittedDraftArchive**
> SubmittedDraftArchive200Response submittedDraftArchive(bulkOperationRequest)

Archive multiple submitted drafts, removing them from active review queues while preserving data

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.submittedDraftArchive(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**SubmittedDraftArchive200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted drafts archived successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftDeleteById**
> SubmittedDraft submittedDraftDeleteById()

Permanently delete a specific submitted draft by ID (requires appropriate permissions)

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftDeleteById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft deleted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftDismissSubmissionById**
> SubmittedDraft submittedDraftDismissSubmissionById()

Dismiss a pending submission for the specified draft, removing it from the review queue

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftGet**
> SubmittedDraftGet200Response submittedDraftGet()

Retrieve a list of all submitted drafts in the review queue

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.submittedDraftGet(
    aposMode,
    aposLocale,
    renderAreas
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|
| **renderAreas** | [**boolean**] | 💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures | (optional) defaults to false|


### Return type

**SubmittedDraftGet200Response**

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
|**403** | Access forbidden - insufficient permissions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftGetById**
> SubmittedDraft submittedDraftGetById()

Retrieve a specific submitted draft by ID (requires appropriate permissions)

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftGetById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftGetLocaleById**
> SubmittedDraft submittedDraftGetLocaleById()

Retrieve the specified submitted draft in a specific locale

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftGetLocaleById(
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

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftGetLocalesById**
> Array<string> submittedDraftGetLocalesById()

Retrieve all available locales for the specified submitted draft

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftGetLocalesById(
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

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftLocalize**
> SubmittedDraftLocalize200Response submittedDraftLocalize()

Create or update localized versions of submitted drafts for different languages/regions

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

const { status, data } = await apiInstance.submittedDraftLocalize();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**SubmittedDraftLocalize200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted drafts localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftLocalizeById**
> SubmittedDraft submittedDraftLocalizeById()

Create a localized version of the specified submitted draft for a specific language/region

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftLocalizeById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftPatchById**
> SubmittedDraft submittedDraftPatchById(submittedDraftPatchByIdRequest)

Partially update a specific submitted draft by ID using PATCH semantics

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration,
    SubmittedDraftPatchByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let submittedDraftPatchByIdRequest: SubmittedDraftPatchByIdRequest; //

const { status, data } = await apiInstance.submittedDraftPatchById(
    id,
    submittedDraftPatchByIdRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **submittedDraftPatchByIdRequest** | **SubmittedDraftPatchByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftPost**
> SubmittedDraft submittedDraftPost(submittedDraftPostRequest)

Create a new submitted draft for review workflow (requires contributor permissions or higher)

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration,
    SubmittedDraftPostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let submittedDraftPostRequest: SubmittedDraftPostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.submittedDraftPost(
    submittedDraftPostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **submittedDraftPostRequest** | **SubmittedDraftPostRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft created successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftPublish**
> SubmittedDraftPublish200Response submittedDraftPublish()

Bulk publish multiple submitted drafts, moving them from draft status to published content

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

const { status, data } = await apiInstance.submittedDraftPublish();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**SubmittedDraftPublish200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted drafts published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftPublishById**
> SubmittedDraft submittedDraftPublishById()

Publish the specified submitted draft, moving it from draft status to published content

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftPublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftPutById**
> SubmittedDraft submittedDraftPutById(submittedDraftPutByIdRequest)

Completely replace a specific submitted draft by ID using PUT semantics

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration,
    SubmittedDraftPutByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let submittedDraftPutByIdRequest: SubmittedDraftPutByIdRequest; //

const { status, data } = await apiInstance.submittedDraftPutById(
    id,
    submittedDraftPutByIdRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **submittedDraftPutByIdRequest** | **SubmittedDraftPutByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftRestore**
> SubmittedDraftRestore200Response submittedDraftRestore(bulkOperationRequest)

Restore previously archived submitted drafts, returning them to active review queues

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.submittedDraftRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**SubmittedDraftRestore200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted drafts restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftRevertDraftToPublishedById**
> SubmittedDraft submittedDraftRevertDraftToPublishedById()

Revert the draft version of the specified submitted draft back to its published state

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftRevertPublishedToPreviousById**
> SubmittedDraft submittedDraftRevertPublishedToPreviousById()

Revert the published version of the specified submitted draft to its previous published state

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftShareById**
> SubmittedDraft submittedDraftShareById()

Generate a sharing link or configure sharing permissions for the specified submitted draft

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftSubmitById**
> SubmittedDraft submittedDraftSubmitById()

Submit the specified draft for review and approval workflow

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Draft submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submittedDraftUnpublishById**
> SubmittedDraft submittedDraftUnpublishById()

Unpublish the specified submitted draft, removing it from public visibility while preserving the content

### Example

```typescript
import {
    SubmittedDraftsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new SubmittedDraftsApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.submittedDraftUnpublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**SubmittedDraft**

### Authorization

[SessionAuth](../README.md#SessionAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Submitted draft unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


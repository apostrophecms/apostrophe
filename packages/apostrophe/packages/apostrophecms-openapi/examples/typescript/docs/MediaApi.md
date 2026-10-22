# MediaApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**fileArchive**](#filearchive) | **POST** /@apostrophecms/file/archive | Archive files|
|[**fileDeleteById**](#filedeletebyid) | **DELETE** /@apostrophecms/file/{_id} | Delete file|
|[**fileDismissSubmissionById**](#filedismisssubmissionbyid) | **POST** /@apostrophecms/file/{_id}/dismiss-submission | Dismiss file submission|
|[**fileGet**](#fileget) | **GET** /@apostrophecms/file | List files|
|[**fileGetById**](#filegetbyid) | **GET** /@apostrophecms/file/{_id} | Get file by ID|
|[**fileGetLocaleById**](#filegetlocalebyid) | **GET** /@apostrophecms/file/{_id}/locale/{toLocale} | Get file locale|
|[**fileGetLocalesById**](#filegetlocalesbyid) | **GET** /@apostrophecms/file/{_id}/locales | Get file locales|
|[**fileLocalize**](#filelocalize) | **POST** /@apostrophecms/file/localize | Localize files|
|[**fileLocalizeById**](#filelocalizebyid) | **POST** /@apostrophecms/file/{_id}/localize | Localize file|
|[**filePatchById**](#filepatchbyid) | **PATCH** /@apostrophecms/file/{_id} | Update file|
|[**filePost**](#filepost) | **POST** /@apostrophecms/file | Create file|
|[**filePublish**](#filepublish) | **POST** /@apostrophecms/file/publish | Publish files|
|[**filePublishById**](#filepublishbyid) | **POST** /@apostrophecms/file/{_id}/publish | Publish file|
|[**filePutById**](#fileputbyid) | **PUT** /@apostrophecms/file/{_id} | Replace file|
|[**fileRestore**](#filerestore) | **POST** /@apostrophecms/file/restore | Restore files|
|[**fileRevertDraftToPublishedById**](#filerevertdrafttopublishedbyid) | **POST** /@apostrophecms/file/{_id}/revert-draft-to-published | Revert file draft to published|
|[**fileRevertPublishedToPreviousById**](#filerevertpublishedtopreviousbyid) | **POST** /@apostrophecms/file/{_id}/revert-published-to-previous | Revert file published to previous|
|[**fileShareById**](#filesharebyid) | **POST** /@apostrophecms/file/{_id}/share | Share file|
|[**fileSubmitById**](#filesubmitbyid) | **POST** /@apostrophecms/file/{_id}/submit | Submit file|
|[**fileTagArchive**](#filetagarchive) | **POST** /@apostrophecms/file-tag/archive | Archive file tags|
|[**fileTagDeleteById**](#filetagdeletebyid) | **DELETE** /@apostrophecms/file-tag/{_id} | Delete file tag|
|[**fileTagDismissSubmissionById**](#filetagdismisssubmissionbyid) | **POST** /@apostrophecms/file-tag/{_id}/dismiss-submission | Dismiss file tag submission|
|[**fileTagGet**](#filetagget) | **GET** /@apostrophecms/file-tag | List file tags|
|[**fileTagGetById**](#filetaggetbyid) | **GET** /@apostrophecms/file-tag/{_id} | Get file tag|
|[**fileTagGetLocaleById**](#filetaggetlocalebyid) | **GET** /@apostrophecms/file-tag/{_id}/locale/{toLocale} | Get file tag locale|
|[**fileTagGetLocalesById**](#filetaggetlocalesbyid) | **GET** /@apostrophecms/file-tag/{_id}/locales | Get file tag locales|
|[**fileTagLocalize**](#filetaglocalize) | **POST** /@apostrophecms/file-tag/localize | Localize file tags|
|[**fileTagLocalizeById**](#filetaglocalizebyid) | **POST** /@apostrophecms/file-tag/{_id}/localize | Localize file tag|
|[**fileTagPatchById**](#filetagpatchbyid) | **PATCH** /@apostrophecms/file-tag/{_id} | Update file tag|
|[**fileTagPost**](#filetagpost) | **POST** /@apostrophecms/file-tag | Create file tag|
|[**fileTagPublish**](#filetagpublish) | **POST** /@apostrophecms/file-tag/publish | Publish file tags|
|[**fileTagPublishById**](#filetagpublishbyid) | **POST** /@apostrophecms/file-tag/{_id}/publish | Publish file tag|
|[**fileTagPutById**](#filetagputbyid) | **PUT** /@apostrophecms/file-tag/{_id} | Replace file tag|
|[**fileTagRestore**](#filetagrestore) | **POST** /@apostrophecms/file-tag/restore | Restore file tags|
|[**fileTagRevertDraftToPublishedById**](#filetagrevertdrafttopublishedbyid) | **POST** /@apostrophecms/file-tag/{_id}/revert-draft-to-published | Revert file tag draft to published|
|[**fileTagRevertPublishedToPreviousById**](#filetagrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/file-tag/{_id}/revert-published-to-previous | Revert file tag published to previous|
|[**fileTagShareById**](#filetagsharebyid) | **POST** /@apostrophecms/file-tag/{_id}/share | Share file tag|
|[**fileTagSubmitById**](#filetagsubmitbyid) | **POST** /@apostrophecms/file-tag/{_id}/submit | Submit file tag|
|[**fileTagUnpublishById**](#filetagunpublishbyid) | **POST** /@apostrophecms/file-tag/{_id}/unpublish | Unpublish file tag|
|[**fileUnpublishById**](#fileunpublishbyid) | **POST** /@apostrophecms/file/{_id}/unpublish | Unpublish file|
|[**imageArchive**](#imagearchive) | **POST** /@apostrophecms/image/archive | Archive images|
|[**imageAutocrop**](#imageautocrop) | **POST** /@apostrophecms/image/autocrop | Auto-crop images|
|[**imageDeleteById**](#imagedeletebyid) | **DELETE** /@apostrophecms/image/{_id} | Delete image document|
|[**imageDismissSubmissionById**](#imagedismisssubmissionbyid) | **POST** /@apostrophecms/image/{_id}/dismiss-submission | Dismiss image submission|
|[**imageGet**](#imageget) | **GET** /@apostrophecms/image | Get images|
|[**imageGetById**](#imagegetbyid) | **GET** /@apostrophecms/image/{_id} | Get image document|
|[**imageGetLocaleById**](#imagegetlocalebyid) | **GET** /@apostrophecms/image/{_id}/locale/{toLocale} | Get image document locale|
|[**imageGetLocalesById**](#imagegetlocalesbyid) | **GET** /@apostrophecms/image/{_id}/locales | Get image document locales|
|[**imageGetSrcById**](#imagegetsrcbyid) | **GET** /@apostrophecms/image/{_id}/src | Get image source URL|
|[**imageLocalize**](#imagelocalize) | **POST** /@apostrophecms/image/localize | Localize images|
|[**imageLocalizeById**](#imagelocalizebyid) | **POST** /@apostrophecms/image/{_id}/localize | Localize image document|
|[**imagePatchById**](#imagepatchbyid) | **PATCH** /@apostrophecms/image/{_id} | Update image document|
|[**imagePost**](#imagepost) | **POST** /@apostrophecms/image | Create image|
|[**imagePublish**](#imagepublish) | **POST** /@apostrophecms/image/publish | Publish images|
|[**imagePublishById**](#imagepublishbyid) | **POST** /@apostrophecms/image/{_id}/publish | Publish image document|
|[**imagePutById**](#imageputbyid) | **PUT** /@apostrophecms/image/{_id} | Replace image document|
|[**imageRestore**](#imagerestore) | **POST** /@apostrophecms/image/restore | Restore images|
|[**imageRevertDraftToPublishedById**](#imagerevertdrafttopublishedbyid) | **POST** /@apostrophecms/image/{_id}/revert-draft-to-published | Revert image draft to published|
|[**imageRevertPublishedToPreviousById**](#imagerevertpublishedtopreviousbyid) | **POST** /@apostrophecms/image/{_id}/revert-published-to-previous | Revert image published to previous|
|[**imageShareById**](#imagesharebyid) | **POST** /@apostrophecms/image/{_id}/share | Share image document|
|[**imageSubmitById**](#imagesubmitbyid) | **POST** /@apostrophecms/image/{_id}/submit | Submit image document|
|[**imageTag**](#imagetag) | **POST** /@apostrophecms/image/tag | Tag images|
|[**imageTagArchive**](#imagetagarchive) | **POST** /@apostrophecms/image-tag/archive | Archive image tags|
|[**imageTagDeleteById**](#imagetagdeletebyid) | **DELETE** /@apostrophecms/image-tag/{_id} | Delete image tag|
|[**imageTagDismissSubmissionById**](#imagetagdismisssubmissionbyid) | **POST** /@apostrophecms/image-tag/{_id}/dismiss-submission | Dismiss image tag submission|
|[**imageTagGet**](#imagetagget) | **GET** /@apostrophecms/image-tag | Get image tags|
|[**imageTagGetById**](#imagetaggetbyid) | **GET** /@apostrophecms/image-tag/{_id} | Get image tag|
|[**imageTagGetLocaleById**](#imagetaggetlocalebyid) | **GET** /@apostrophecms/image-tag/{_id}/locale/{toLocale} | Get image tag locale|
|[**imageTagGetLocalesById**](#imagetaggetlocalesbyid) | **GET** /@apostrophecms/image-tag/{_id}/locales | Get image tag locales|
|[**imageTagLocalize**](#imagetaglocalize) | **POST** /@apostrophecms/image-tag/localize | Localize image tags|
|[**imageTagLocalizeById**](#imagetaglocalizebyid) | **POST** /@apostrophecms/image-tag/{_id}/localize | Localize image tag|
|[**imageTagPatchById**](#imagetagpatchbyid) | **PATCH** /@apostrophecms/image-tag/{_id} | Update image tag|
|[**imageTagPost**](#imagetagpost) | **POST** /@apostrophecms/image-tag | Create image tag|
|[**imageTagPublish**](#imagetagpublish) | **POST** /@apostrophecms/image-tag/publish | Publish image tags|
|[**imageTagPublishById**](#imagetagpublishbyid) | **POST** /@apostrophecms/image-tag/{_id}/publish | Publish image tag|
|[**imageTagPutById**](#imagetagputbyid) | **PUT** /@apostrophecms/image-tag/{_id} | Replace image tag|
|[**imageTagRestore**](#imagetagrestore) | **POST** /@apostrophecms/image-tag/restore | Restore image tags|
|[**imageTagRevertDraftToPublishedById**](#imagetagrevertdrafttopublishedbyid) | **POST** /@apostrophecms/image-tag/{_id}/revert-draft-to-published | Revert draft to published|
|[**imageTagRevertPublishedToPreviousById**](#imagetagrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/image-tag/{_id}/revert-published-to-previous | Revert published to previous|
|[**imageTagShareById**](#imagetagsharebyid) | **POST** /@apostrophecms/image-tag/{_id}/share | Share image tag|
|[**imageTagSubmitById**](#imagetagsubmitbyid) | **POST** /@apostrophecms/image-tag/{_id}/submit | Submit image tag|
|[**imageTagUnpublishById**](#imagetagunpublishbyid) | **POST** /@apostrophecms/image-tag/{_id}/unpublish | Unpublish image tag|
|[**imageUnpublishById**](#imageunpublishbyid) | **POST** /@apostrophecms/image/{_id}/unpublish | Unpublish image document|

# **fileArchive**
> PageArchive200Response fileArchive(bulkOperationRequest)

Archive multiple files, making them inactive while preserving their data

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.fileArchive(
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

# **fileDeleteById**
> FileObject fileDeleteById()

Permanently delete a specific file by ID (requires appropriate permissions)

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.fileDeleteById(
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

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File deleted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileDismissSubmissionById**
> FileObject fileDismissSubmissionById()

Dismiss a pending submission for the specified file, removing it from the review queue

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileGet**
> FileGet200Response fileGet()

Retrieve a paginated list of files from the media library

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let page: number; //Page number for pagination (1-based) (optional) (default to 1)
let perPage: number; //Number of items per page (optional) (default to 10)
let search: string; //Search term for filtering results (optional) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.fileGet(
    page,
    perPage,
    search,
    aposMode,
    aposLocale,
    renderAreas
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | Page number for pagination (1-based) | (optional) defaults to 1|
| **perPage** | [**number**] | Number of items per page | (optional) defaults to 10|
| **search** | [**string**] | Search term for filtering results | (optional) defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|
| **renderAreas** | [**boolean**] | 💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures | (optional) defaults to false|


### Return type

**FileGet200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Files retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileGetById**
> FileObject fileGetById()

Retrieve a specific file by ID from the media library

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.fileGetById(
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

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileGetLocaleById**
> FileObject fileGetLocaleById()

Retrieve the specified file in a specific locale

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.fileGetLocaleById(
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

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileGetLocalesById**
> Array<string> fileGetLocalesById()

Retrieve all available locales for the specified file

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileGetLocalesById(
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
|**200** | File locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileLocalize**
> Array<FileObject> fileLocalize()

Create or update localized versions of files for different languages/regions

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

const { status, data } = await apiInstance.fileLocalize();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<FileObject>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Files localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileLocalizeById**
> FileObject fileLocalizeById()

Create a localized version of the specified file for a specific language/region

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileLocalizeById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **filePatchById**
> FileObject filePatchById(filePatchByIdRequest)

Partially update a specific file by ID using PATCH semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FilePatchByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let filePatchByIdRequest: FilePatchByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.filePatchById(
    id,
    filePatchByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **filePatchByIdRequest** | **FilePatchByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **filePost**
> FileObject filePost(filePostRequest)

Create a new file document (requires prior attachment upload)

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FilePostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let filePostRequest: FilePostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.filePost(
    filePostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **filePostRequest** | **FilePostRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File created successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **filePublish**
> Array<FileObject> filePublish()

Bulk publish multiple files, making them live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

const { status, data } = await apiInstance.filePublish();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<FileObject>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Files published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **filePublishById**
> FileObject filePublishById()

Publish the specified file, making it live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.filePublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **filePutById**
> FileObject filePutById(filePostRequest)

Completely replace a specific file by ID using PUT semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FilePostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let filePostRequest: FilePostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.filePutById(
    id,
    filePostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **filePostRequest** | **FilePostRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileRestore**
> Array<FileObject> fileRestore(bulkOperationRequest)

Restore previously archived files, making them active again

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.fileRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Array<FileObject>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Files restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileRevertDraftToPublishedById**
> FileObject fileRevertDraftToPublishedById()

Revert the draft version of the specified file back to its published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileRevertPublishedToPreviousById**
> FileObject fileRevertPublishedToPreviousById()

Revert the published version of the specified file to its previous published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileShareById**
> FileObject fileShareById()

Generate a sharing link or configure sharing permissions for the specified file

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileSubmitById**
> FileObject fileSubmitById()

Submit the specified file for review and approval workflow

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagArchive**
> Array<FileTag> fileTagArchive(bulkOperationRequest)

Archive multiple file tags, making them inactive while preserving their data

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.fileTagArchive(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Array<FileTag>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tags archived successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagDeleteById**
> FileTag fileTagDeleteById()

Permanently delete a specific file tag by ID (requires appropriate permissions)

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagDeleteById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag deleted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagDismissSubmissionById**
> FileTag fileTagDismissSubmissionById()

Dismiss a pending submission for the specified file tag, removing it from the review queue

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagGet**
> FileTagGet200Response fileTagGet()

Retrieve a list of file tags used for organizing and categorizing uploaded files

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.fileTagGet(
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

**FileTagGet200Response**

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

# **fileTagGetById**
> FileTag fileTagGetById()

Retrieve a specific file tag by ID

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.fileTagGetById(
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

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagGetLocaleById**
> FileTag fileTagGetLocaleById()

Retrieve the specified file tag in a specific locale

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.fileTagGetLocaleById(
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

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagGetLocalesById**
> Array<string> fileTagGetLocalesById()

Retrieve all available locales for the specified file tag

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagGetLocalesById(
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
|**200** | File tag locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagLocalize**
> Array<FileTag> fileTagLocalize(fileTagLocalizeRequest)

Create or update localized versions of file tags for different languages/regions

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FileTagLocalizeRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let fileTagLocalizeRequest: FileTagLocalizeRequest; //

const { status, data } = await apiInstance.fileTagLocalize(
    fileTagLocalizeRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileTagLocalizeRequest** | **FileTagLocalizeRequest**|  | |


### Return type

**Array<FileTag>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tags localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagLocalizeById**
> FileTag fileTagLocalizeById(pageLocalizeByIdRequest)

Create a localized version of the specified file tag for a specific language/region

### Example

```typescript
import {
    MediaApi,
    Configuration,
    PageLocalizeByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let pageLocalizeByIdRequest: PageLocalizeByIdRequest; //

const { status, data } = await apiInstance.fileTagLocalizeById(
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

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagPatchById**
> FileTag fileTagPatchById(fileTagPatchByIdRequest)

Partially update a specific file tag by ID using PATCH semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FileTagPatchByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let fileTagPatchByIdRequest: FileTagPatchByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.fileTagPatchById(
    id,
    fileTagPatchByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileTagPatchByIdRequest** | **FileTagPatchByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagPost**
> FileTag fileTagPost(fileTagPostRequest)

Create a new file tag for organizing uploaded files (requires editor permissions or higher)

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FileTagPostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let fileTagPostRequest: FileTagPostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.fileTagPost(
    fileTagPostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileTagPostRequest** | **FileTagPostRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag created successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagPublish**
> Array<FileTag> fileTagPublish(fileTagPublishRequest)

Publish multiple file tags, making them live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FileTagPublishRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let fileTagPublishRequest: FileTagPublishRequest; //

const { status, data } = await apiInstance.fileTagPublish(
    fileTagPublishRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileTagPublishRequest** | **FileTagPublishRequest**|  | |


### Return type

**Array<FileTag>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tags published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagPublishById**
> FileTag fileTagPublishById()

Publish the specified file tag, making it live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagPublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagPutById**
> FileTag fileTagPutById(fileTagPutByIdRequest)

Completely replace a specific file tag by ID using PUT semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    FileTagPutByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let fileTagPutByIdRequest: FileTagPutByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.fileTagPutById(
    id,
    fileTagPutByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **fileTagPutByIdRequest** | **FileTagPutByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagRestore**
> Array<FileTag> fileTagRestore(bulkOperationRequest)

Restore previously archived file tags, making them active again

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.fileTagRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Array<FileTag>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tags restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagRevertDraftToPublishedById**
> FileTag fileTagRevertDraftToPublishedById()

Revert the draft version of the specified file tag back to its published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagRevertPublishedToPreviousById**
> FileTag fileTagRevertPublishedToPreviousById()

Revert the published version of the specified file tag to its previous published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagShareById**
> FileTag fileTagShareById()

Generate a sharing link or configure sharing permissions for the specified file tag

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagSubmitById**
> FileTag fileTagSubmitById()

Submit the specified file tag for review and approval workflow

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileTagUnpublishById**
> FileTag fileTagUnpublishById()

Unpublish the specified file tag, removing it from public visibility while preserving the content

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileTagUnpublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File tag unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fileUnpublishById**
> FileObject fileUnpublishById()

Unpublish the specified file, removing it from public visibility while preserving the content

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.fileUnpublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**FileObject**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageArchive**
> PageArchive200Response imageArchive(bulkOperationRequest)

Archive multiple images, making them inactive while preserving their data

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.imageArchive(
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

# **imageAutocrop**
> Array<Image> imageAutocrop(imageAutocropRequest)

Automatically crop uploaded images using intelligent cropping algorithms

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImageAutocropRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let imageAutocropRequest: ImageAutocropRequest; //

const { status, data } = await apiInstance.imageAutocrop(
    imageAutocropRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageAutocropRequest** | **ImageAutocropRequest**|  | |


### Return type

**Array<Image>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Images auto-cropped successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageDeleteById**
> Image imageDeleteById()

Permanently delete a specific image document by ID (requires appropriate permissions)

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageDeleteById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image deleted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageDismissSubmissionById**
> Image imageDismissSubmissionById()

Dismiss a pending submission for the specified image document, removing it from the review queue

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageGet**
> ImageGet200Response imageGet()

Retrieve images from the media library.  Authentication is required for all requests other than GET requests  for images with defined publicApiProjection. 

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let page: number; //Page number for pagination (1-based) (optional) (default to 1)
let perPage: number; //Number of items per page (optional) (default to 10)
let search: string; //Search term for filtering results (optional) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.imageGet(
    page,
    perPage,
    search,
    aposMode,
    aposLocale,
    renderAreas
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | Page number for pagination (1-based) | (optional) defaults to 1|
| **perPage** | [**number**] | Number of items per page | (optional) defaults to 10|
| **search** | [**string**] | Search term for filtering results | (optional) defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|
| **renderAreas** | [**boolean**] | 💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures | (optional) defaults to false|


### Return type

**ImageGet200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Images retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageGetById**
> Image imageGetById()

Retrieve a specific image by ID from the media library. Authentication is required for all requests other than GET requests  for images with defined publicApiProjection. 

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.imageGetById(
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

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageGetLocaleById**
> Image imageGetLocaleById()

Retrieve the specified image document in a specific locale

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.imageGetLocaleById(
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

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageGetLocalesById**
> Array<string> imageGetLocalesById()

Retrieve all available locales for the specified image document

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageGetLocalesById(
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
|**200** | Image locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageGetSrcById**
> ImageGetSrcById200Response imageGetSrcById()

Retrieve the source URL for a specific image, with optional size and format parameters

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let size: 'thumbnail' | 'small' | 'medium' | 'large' | 'original'; //Image size variant (optional) (default to 'original')
let format: 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif'; //Image format (optional) (default to undefined)
let quality: number; //Image quality (1-100) (optional) (default to 80)

const { status, data } = await apiInstance.imageGetSrcById(
    id,
    size,
    format,
    quality
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **size** | [**&#39;thumbnail&#39; | &#39;small&#39; | &#39;medium&#39; | &#39;large&#39; | &#39;original&#39;**]**Array<&#39;thumbnail&#39; &#124; &#39;small&#39; &#124; &#39;medium&#39; &#124; &#39;large&#39; &#124; &#39;original&#39;>** | Image size variant | (optional) defaults to 'original'|
| **format** | [**&#39;jpg&#39; | &#39;jpeg&#39; | &#39;png&#39; | &#39;webp&#39; | &#39;avif&#39;**]**Array<&#39;jpg&#39; &#124; &#39;jpeg&#39; &#124; &#39;png&#39; &#124; &#39;webp&#39; &#124; &#39;avif&#39;>** | Image format | (optional) defaults to undefined|
| **quality** | [**number**] | Image quality (1-100) | (optional) defaults to 80|


### Return type

**ImageGetSrcById200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image source URL retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageLocalize**
> Array<Image> imageLocalize(imageLocalizeRequest)

Create or update localized versions of images for different languages/regions

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImageLocalizeRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let imageLocalizeRequest: ImageLocalizeRequest; //

const { status, data } = await apiInstance.imageLocalize(
    imageLocalizeRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageLocalizeRequest** | **ImageLocalizeRequest**|  | |


### Return type

**Array<Image>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Images localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageLocalizeById**
> Image imageLocalizeById(pageLocalizeByIdRequest)

Create a localized version of the specified image document for a specific language/region

### Example

```typescript
import {
    MediaApi,
    Configuration,
    PageLocalizeByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let pageLocalizeByIdRequest: PageLocalizeByIdRequest; //

const { status, data } = await apiInstance.imageLocalizeById(
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

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imagePatchById**
> Image imagePatchById(imagePatchByIdRequest)

Partially update a specific image document by ID using PATCH semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImagePatchByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let imagePatchByIdRequest: ImagePatchByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.imagePatchById(
    id,
    imagePatchByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imagePatchByIdRequest** | **ImagePatchByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imagePost**
> Image imagePost(imagePostRequest)

Create a new image document (requires prior attachment upload)

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImagePostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let imagePostRequest: ImagePostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.imagePost(
    imagePostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imagePostRequest** | **ImagePostRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image created successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imagePublish**
> Array<Image> imagePublish(imagePublishRequest)

Bulk publish multiple images, making them live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImagePublishRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let imagePublishRequest: ImagePublishRequest; //

const { status, data } = await apiInstance.imagePublish(
    imagePublishRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imagePublishRequest** | **ImagePublishRequest**|  | |


### Return type

**Array<Image>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Images published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imagePublishById**
> Image imagePublishById()

Publish the specified image document, making it live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imagePublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imagePutById**
> Image imagePutById(imagePostRequest)

Completely replace an image document by ID using PUT semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImagePostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let imagePostRequest: ImagePostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.imagePutById(
    id,
    imagePostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imagePostRequest** | **ImagePostRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageRestore**
> Array<Image> imageRestore(bulkOperationRequest)

Restore previously archived images, making them active again

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.imageRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Array<Image>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Images restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageRevertDraftToPublishedById**
> Image imageRevertDraftToPublishedById()

Revert the draft version of the specified image document back to its published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageRevertPublishedToPreviousById**
> Image imageRevertPublishedToPreviousById()

Revert the published version of the specified image document to its previous published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageShareById**
> Image imageShareById()

Generate a sharing link or configure sharing permissions for the specified image document

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageSubmitById**
> Image imageSubmitById()

Submit the specified image document for review and approval workflow

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTag**
> Array<Image> imageTag(imageTagRequest)

Add tags to multiple images for better organization and searchability

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImageTagRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let imageTagRequest: ImageTagRequest; //

const { status, data } = await apiInstance.imageTag(
    imageTagRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageTagRequest** | **ImageTagRequest**|  | |


### Return type

**Array<Image>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Images tagged successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagArchive**
> PageArchive200Response imageTagArchive(bulkOperationRequest)

Archive multiple image tags, making them inactive while preserving their data

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.imageTagArchive(
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

# **imageTagDeleteById**
> ImageTag imageTagDeleteById()

Permanently delete a specific image tag by ID (requires appropriate permissions)

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagDeleteById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag deleted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagDismissSubmissionById**
> ImageTag imageTagDismissSubmissionById()

Dismiss a pending submission for the specified image tag, removing it from the review queue

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagGet**
> ImageTagGet200Response imageTagGet()

Retrieve image tags for organizing images

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let page: number; //Page number for pagination (1-based) (optional) (default to 1)
let perPage: number; //Number of items per page (optional) (default to 10)
let search: string; //Search term for filtering results (optional) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.imageTagGet(
    page,
    perPage,
    search,
    aposMode,
    aposLocale,
    renderAreas
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | Page number for pagination (1-based) | (optional) defaults to 1|
| **perPage** | [**number**] | Number of items per page | (optional) defaults to 10|
| **search** | [**string**] | Search term for filtering results | (optional) defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|
| **renderAreas** | [**boolean**] | 💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures | (optional) defaults to false|


### Return type

**ImageTagGet200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful response |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagGetById**
> ImageTag imageTagGetById()

Retrieve a specific image tag by ID

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.imageTagGetById(
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

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagGetLocaleById**
> ImageTag imageTagGetLocaleById()

Retrieve the specified image tag in a specific locale

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.imageTagGetLocaleById(
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

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagGetLocalesById**
> Array<string> imageTagGetLocalesById()

Retrieve all available locales for the specified image tag

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagGetLocalesById(
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
|**200** | Image tag locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagLocalize**
> Array<ImageTag> imageTagLocalize()

Create or update localized versions of image tags for different languages/regions

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

const { status, data } = await apiInstance.imageTagLocalize();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<ImageTag>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tags localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagLocalizeById**
> ImageTag imageTagLocalizeById()

Create a localized version of the specified image tag for a specific language/region

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagLocalizeById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagPatchById**
> ImageTag imageTagPatchById(imageTagPatchByIdRequest)

Partially update a specific image tag by ID using PATCH semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImageTagPatchByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let imageTagPatchByIdRequest: ImageTagPatchByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.imageTagPatchById(
    id,
    imageTagPatchByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageTagPatchByIdRequest** | **ImageTagPatchByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagPost**
> ImageTag imageTagPost(imageTagPostRequest)

Create a new image tag for organizing images

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImageTagPostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let imageTagPostRequest: ImageTagPostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.imageTagPost(
    imageTagPostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageTagPostRequest** | **ImageTagPostRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag created successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagPublish**
> Array<ImageTag> imageTagPublish()

Publish multiple image tags, making them live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

const { status, data } = await apiInstance.imageTagPublish();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<ImageTag>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tags published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagPublishById**
> ImageTag imageTagPublishById()

Publish the specified image tag, making it live and visible to end users

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagPublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagPutById**
> ImageTag imageTagPutById(imageTagPostRequest)

Completely replace a specific image tag by ID using PUT semantics

### Example

```typescript
import {
    MediaApi,
    Configuration,
    ImageTagPostRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let imageTagPostRequest: ImageTagPostRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.imageTagPutById(
    id,
    imageTagPostRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageTagPostRequest** | **ImageTagPostRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagRestore**
> Array<ImageTag> imageTagRestore(bulkOperationRequest)

Restore previously archived image tags, making them active again

### Example

```typescript
import {
    MediaApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.imageTagRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Array<ImageTag>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tags restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagRevertDraftToPublishedById**
> ImageTag imageTagRevertDraftToPublishedById()

Revert the draft version of the specified image tag back to its published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagRevertPublishedToPreviousById**
> ImageTag imageTagRevertPublishedToPreviousById()

Revert the published version of the specified image tag to its previous published state

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagShareById**
> ImageTag imageTagShareById()

Generate a sharing link or configure sharing permissions for the specified image tag

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagSubmitById**
> ImageTag imageTagSubmitById()

Submit the specified image tag for review and approval workflow

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageTagUnpublishById**
> ImageTag imageTagUnpublishById()

Unpublish the specified image tag, removing it from public visibility while preserving the content

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageTagUnpublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**ImageTag**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image tag unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **imageUnpublishById**
> Image imageUnpublishById()

Unpublish the specified image document, removing it from public visibility while preserving the content

### Example

```typescript
import {
    MediaApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new MediaApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.imageUnpublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**Image**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


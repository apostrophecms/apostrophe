# AttachmentsApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**attachmentCrop**](#attachmentcrop) | **POST** /@apostrophecms/attachment/crop | Crop image attachment|
|[**attachmentUpload**](#attachmentupload) | **POST** /@apostrophecms/attachment/upload | Upload media file|

# **attachmentCrop**
> boolean attachmentCrop(attachmentCropRequest)

Create a cropped version of an existing image attachment. The crop object is appended to the crops array property of the attachment document. The newly uploaded image file will be stored with a filename using the crop properties: {_id}-{name}.{top}.{left}.{width}.{height}.{extension} 

### Example

```typescript
import {
    AttachmentsApi,
    Configuration,
    AttachmentCropRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AttachmentsApi(configuration);

let attachmentCropRequest: AttachmentCropRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.attachmentCrop(
    attachmentCropRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **attachmentCropRequest** | **AttachmentCropRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**boolean**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Image cropped successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**404** | Resource not found |  -  |
|**422** | Unprocessable entity - crop coordinates exceed image bounds |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **attachmentUpload**
> Attachment attachmentUpload()

Upload a media file to create an attachment. The uploaded file can then be used to create image or file documents. Uses multipart/form-data encoding with the file uploaded under the name \'file\'. 

### Example

```typescript
import {
    AttachmentsApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AttachmentsApi(configuration);

let file: File; //The file to upload (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.attachmentUpload(
    file,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] | The file to upload | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**Attachment**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | File uploaded successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**413** | File too large |  -  |
|**415** | Unsupported file type |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


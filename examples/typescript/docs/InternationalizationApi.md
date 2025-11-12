# InternationalizationApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**i18nExistsPost**](#i18nexistspost) | **POST** /@apostrophecms/i18n/exist-in-locale | Check document existence in locale|
|[**i18nLocalePost**](#i18nlocalepost) | **POST** /@apostrophecms/i18n/locale | Get locale path and manage clipboard|
|[**i18nLocalesGet**](#i18nlocalesget) | **GET** /@apostrophecms/i18n/locales | Get all configured locales|

# **i18nExistsPost**
> ExistInLocaleResponse i18nExistsPost(existInLocaleRequest)

Returns arrays of original document IDs, new locale IDs, and aposDocIds  for an array of document IDs in a specified locale and mode. 

### Example

```typescript
import {
    InternationalizationApi,
    Configuration,
    ExistInLocaleRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new InternationalizationApi(configuration);

let ids: Array<string>; //Required. Array of document IDs to check in the specified locale (default to undefined)
let locale: string; //Required. The locale in which to check for the document IDs (default to undefined)
let mode: 'draft' | 'published'; //Required. The mode (draft or published) in which to check for the document IDs (default to undefined)
let existInLocaleRequest: ExistInLocaleRequest; //

const { status, data } = await apiInstance.i18nExistsPost(
    ids,
    locale,
    mode,
    existInLocaleRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **existInLocaleRequest** | **ExistInLocaleRequest**|  | |
| **ids** | **Array&lt;string&gt;** | Required. Array of document IDs to check in the specified locale | defaults to undefined|
| **locale** | [**string**] | Required. The locale in which to check for the document IDs | defaults to undefined|
| **mode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Required. The mode (draft or published) in which to check for the document IDs | defaults to undefined|


### Return type

**ExistInLocaleResponse**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Document existence check completed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **i18nLocalePost**
> I18nLocalePost200Response i18nLocalePost(localeRequest)

Returns the path to a locale home-page or optional document and makes the clipboard  available in the given locale. Used for cross-locale navigation. 

### Example

```typescript
import {
    InternationalizationApi,
    Configuration,
    LocaleRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new InternationalizationApi(configuration);

let locale: string; //Required. The locale for the desired path (default to undefined)
let localeRequest: LocaleRequest; //
let contextDocId: string; //Optional document ID for the path, defaults to locale home-page (optional) (default to undefined)
let clipboard: string; //Optional clipboard content for cross-domain situations (optional) (default to undefined)

const { status, data } = await apiInstance.i18nLocalePost(
    locale,
    localeRequest,
    contextDocId,
    clipboard
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **localeRequest** | **LocaleRequest**|  | |
| **locale** | [**string**] | Required. The locale for the desired path | defaults to undefined|
| **contextDocId** | [**string**] | Optional document ID for the path, defaults to locale home-page | (optional) defaults to undefined|
| **clipboard** | [**string**] | Optional clipboard content for cross-domain situations | (optional) defaults to undefined|


### Return type

**I18nLocalePost200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Locale path retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **i18nLocalesGet**
> { [key: string]: LocalesResponseValue; } i18nLocalesGet()

Returns information about all configured locales including labels and edit permissions. Authentication is required to access locale configuration data. 

### Example

```typescript
import {
    InternationalizationApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new InternationalizationApi(configuration);

const { status, data } = await apiInstance.i18nLocalesGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**{ [key: string]: LocalesResponseValue; }**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Locales retrieved successfully |  -  |
|**400** | Bad request |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


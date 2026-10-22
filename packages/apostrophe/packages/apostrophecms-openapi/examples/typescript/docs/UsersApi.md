# UsersApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**userArchive**](#userarchive) | **POST** /@apostrophecms/user/archive | Archive users|
|[**userCreate**](#usercreate) | **POST** /@apostrophecms/user | Create user|
|[**userDeleteById**](#userdeletebyid) | **DELETE** /@apostrophecms/user/{_id} | Delete user|
|[**userDismissSubmissionById**](#userdismisssubmissionbyid) | **POST** /@apostrophecms/user/{_id}/dismiss-submission | Dismiss user submission|
|[**userGetById**](#usergetbyid) | **GET** /@apostrophecms/user/{_id} | Get user|
|[**userGetLocaleById**](#usergetlocalebyid) | **GET** /@apostrophecms/user/{_id}/locale/{toLocale} | Get user locale|
|[**userGetLocalesById**](#usergetlocalesbyid) | **GET** /@apostrophecms/user/{_id}/locales | Get user locales|
|[**userList**](#userlist) | **GET** /@apostrophecms/user | List users|
|[**userLocalize**](#userlocalize) | **POST** /@apostrophecms/user/localize | Localize users|
|[**userLocalizeById**](#userlocalizebyid) | **POST** /@apostrophecms/user/{_id}/localize | Localize user|
|[**userPatchById**](#userpatchbyid) | **PATCH** /@apostrophecms/user/{_id} | Update user|
|[**userPublish**](#userpublish) | **POST** /@apostrophecms/user/publish | Publish users|
|[**userPublishById**](#userpublishbyid) | **POST** /@apostrophecms/user/{_id}/publish | Publish user|
|[**userPutById**](#userputbyid) | **PUT** /@apostrophecms/user/{_id} | Replace user|
|[**userRestore**](#userrestore) | **POST** /@apostrophecms/user/restore | Restore users|
|[**userRevertDraftToPublishedById**](#userrevertdrafttopublishedbyid) | **POST** /@apostrophecms/user/{_id}/revert-draft-to-published | Revert draft to published|
|[**userRevertPublishedToPreviousById**](#userrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/user/{_id}/revert-published-to-previous | Revert published to previous|
|[**userShareById**](#usersharebyid) | **POST** /@apostrophecms/user/{_id}/share | Share user|
|[**userSubmitById**](#usersubmitbyid) | **POST** /@apostrophecms/user/{_id}/submit | Submit user|
|[**userUnpublishById**](#userunpublishbyid) | **POST** /@apostrophecms/user/{_id}/unpublish | Unpublish user|

# **userArchive**
> PageArchive200Response userArchive()

Archive multiple users, making them inactive while preserving their data

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

const { status, data } = await apiInstance.userArchive();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**PageArchive200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
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

# **userCreate**
> User userCreate(userCreateRequest)

Create a new user account with the specified properties

### Example

```typescript
import {
    UsersApi,
    Configuration,
    UserCreateRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let userCreateRequest: UserCreateRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.userCreate(
    userCreateRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userCreateRequest** | **UserCreateRequest**|  | |
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User created successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**409** | Conflict - username or email already exists |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userDeleteById**
> User userDeleteById()

Permanently delete a specific user by ID (requires appropriate permissions)

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userDeleteById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User deleted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userDismissSubmissionById**
> User userDismissSubmissionById()

Dismiss a pending submission for the specified user, removing it from the review queue

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userDismissSubmissionById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User submission dismissed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userGetById**
> User userGetById()

Retrieve a specific user by ID

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)
let renderAreas: boolean; //💡 Render widget areas as HTML instead of returning raw widget data - useful for hybrid architectures (optional) (default to false)

const { status, data } = await apiInstance.userGetById(
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

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userGetLocaleById**
> User userGetLocaleById()

Retrieve the specified user in a specific locale

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let toLocale: string; //Target locale code (e.g., en:us:published) (default to undefined)

const { status, data } = await apiInstance.userGetLocaleById(
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

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User locale retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userGetLocalesById**
> Array<string> userGetLocalesById()

Retrieve all available locales for the specified user

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userGetLocalesById(
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
|**200** | User locales retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userList**
> UserList200Response userList()

Retrieve a list of users with optional filtering, sorting, and pagination

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

const { status, data } = await apiInstance.userList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**UserList200Response**

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

# **userLocalize**
> Array<User> userLocalize()

Create or update localized versions of users for different languages/regions

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

const { status, data } = await apiInstance.userLocalize();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<User>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Users localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userLocalizeById**
> User userLocalizeById()

Create a localized version of the specified user for a specific language/region

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userLocalizeById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User localized successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userPatchById**
> User userPatchById(userPatchByIdRequest)

Partially update a specific user by ID using PATCH semantics

### Example

```typescript
import {
    UsersApi,
    Configuration,
    UserPatchByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let userPatchByIdRequest: UserPatchByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.userPatchById(
    id,
    userPatchByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userPatchByIdRequest** | **UserPatchByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User updated successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userPublish**
> Array<User> userPublish()

Publish multiple users, making them live and visible

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

const { status, data } = await apiInstance.userPublish();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<User>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Users published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userPublishById**
> User userPublishById()

Publish the specified user, making them live and visible

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userPublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userPutById**
> User userPutById(userPutByIdRequest)

Completely replace a specific user by ID using PUT semantics

### Example

```typescript
import {
    UsersApi,
    Configuration,
    UserPutByIdRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)
let userPutByIdRequest: UserPutByIdRequest; //
let aposMode: 'draft' | 'published'; //Request draft or published version of content (optional) (default to 'published')
let aposLocale: string; //Locale for internationalization (e.g., \'en\', \'fr\', \'es\') (optional) (default to undefined)

const { status, data } = await apiInstance.userPutById(
    id,
    userPutByIdRequest,
    aposMode,
    aposLocale
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userPutByIdRequest** | **UserPutByIdRequest**|  | |
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|
| **aposMode** | [**&#39;draft&#39; | &#39;published&#39;**]**Array<&#39;draft&#39; &#124; &#39;published&#39;>** | Request draft or published version of content | (optional) defaults to 'published'|
| **aposLocale** | [**string**] | Locale for internationalization (e.g., \&#39;en\&#39;, \&#39;fr\&#39;, \&#39;es\&#39;) | (optional) defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User replaced successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userRestore**
> Array<User> userRestore(bulkOperationRequest)

Restore previously archived users, making them active again

### Example

```typescript
import {
    UsersApi,
    Configuration,
    BulkOperationRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let bulkOperationRequest: BulkOperationRequest; //

const { status, data } = await apiInstance.userRestore(
    bulkOperationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bulkOperationRequest** | **BulkOperationRequest**|  | |


### Return type

**Array<User>**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Users restored successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userRevertDraftToPublishedById**
> User userRevertDraftToPublishedById()

Revert the draft version of the specified user back to its published state

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userRevertDraftToPublishedById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User draft reverted to published successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userRevertPublishedToPreviousById**
> User userRevertPublishedToPreviousById()

Revert the published version of the specified user to its previous published state

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userRevertPublishedToPreviousById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User published version reverted to previous successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userShareById**
> User userShareById()

Generate a sharing link or configure sharing permissions for the specified user

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userShareById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User shared successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userSubmitById**
> User userSubmitById()

Submit the specified user for review and approval workflow

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userSubmitById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User submitted successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **userUnpublishById**
> User userUnpublishById()

Unpublish the specified user, removing them from public visibility while preserving the content

### Example

```typescript
import {
    UsersApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let id: string; //Document ID (can include mode and locale, e.g., id:en:published) (default to undefined)

const { status, data } = await apiInstance.userUnpublishById(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Document ID (can include mode and locale, e.g., id:en:published) | defaults to undefined|


### Return type

**User**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User unpublished successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**403** | Access forbidden - insufficient permissions |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


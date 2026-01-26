# AuthenticationApi

All URIs are relative to *http://localhost:3000/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**authContext**](#authcontext) | **GET** /@apostrophecms/login/context | Get login context information|
|[**authContextPost**](#authcontextpost) | **POST** /@apostrophecms/login/context | Get login context information|
|[**authLogin**](#authlogin) | **POST** /@apostrophecms/login/login | Login to get authentication token|
|[**authLogout**](#authlogout) | **POST** /@apostrophecms/login/logout | Logout and invalidate session|
|[**authReset**](#authreset) | **POST** /@apostrophecms/login/reset | Complete password reset|
|[**authResetRequest**](#authresetrequest) | **POST** /@apostrophecms/login/reset-request | Request password reset|
|[**authWhoAmI**](#authwhoami) | **GET** /@apostrophecms/login/whoami | Get current user information|
|[**authWhoAmIPost**](#authwhoamipost) | **POST** /@apostrophecms/login/whoami | Get current user information|

# **authContext**
> AuthContext200Response authContext()

**⚠️ DEPRECATED:** This GET endpoint is deprecated due to caching issues. Use the POST method instead.  Returns login context information including environment and requirements. This endpoint provides information about the login system configuration.  **Useful for:** - Understanding available login methods - Checking if password reset is enabled - Getting login system configuration 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.authContext();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**AuthContext200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Login context retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authContextPost**
> AuthContextPost200Response authContextPost()

Returns login context information including environment and requirements. This endpoint provides information about the login system configuration.  **Note:** POST method is recommended for this endpoint to avoid caching issues.  **Useful for:** - Understanding available login methods - Checking if password reset is enabled - Getting login system configuration 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.authContextPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**AuthContextPost200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Login context retrieved successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLogin**
> AuthLogin200Response authLogin(authLoginRequest)

🚀 **Start here!** Authenticate and receive either a bearer token or session cookie for subsequent API requests.  **Perfect for:** - Getting started with the API - Setting up authentication for your app - Testing API access  **Choose your authentication method:** - **Bearer Token** (recommended): omit `session` field or set to `false` - **Session Cookie**: set `session` to `true` and include `credentials: \'include\'` in fetch 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration,
    AuthLoginRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let authLoginRequest: AuthLoginRequest; //

const { status, data } = await apiInstance.authLogin(
    authLoginRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **authLoginRequest** | **AuthLoginRequest**|  | |


### Return type

**AuthLogin200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Login successful |  * Set-Cookie - Session cookie (only when session&#x3D;true) <br>  |
|**400** | Bad request - invalid input parameters |  -  |
|**401** | Authentication required |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLogout**
> AuthLogout200Response authLogout()

End the current session or invalidate the bearer token.  **For bearer token**: include Authorization header **For session cookie**: include credentials in request 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.authLogout();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**AuthLogout200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Logout successful |  -  |
|**401** | Authentication required |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authReset**
> AuthReset200Response authReset(authResetRequest)

Completes a password reset using the token provided in the reset email.  **⚠️ Note:** This endpoint is only available when `passwordReset` is enabled in the login module configuration.  Reset tokens are valid for the number of hours specified in `passwordResetHours` (default: 48 hours). 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration,
    AuthResetRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let authResetRequest: AuthResetRequest; //

const { status, data } = await apiInstance.authReset(
    authResetRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **authResetRequest** | **AuthResetRequest**|  | |


### Return type

**AuthReset200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Password reset completed successfully |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**404** | Resource not found |  -  |
|**410** | Reset token expired |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authResetRequest**
> AuthResetRequest200Response authResetRequest(authResetRequestRequest)

Initiates a password reset process by sending a reset link to the user\'s email address.  **⚠️ Note:** This endpoint is only available when `passwordReset` is enabled in the login module configuration.  **Security feature:** The user will not be notified if the email check fails or if the email fails to send. However, debug information will be output in the server terminal. 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration,
    AuthResetRequestRequest
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

let authResetRequestRequest: AuthResetRequestRequest; //

const { status, data } = await apiInstance.authResetRequest(
    authResetRequestRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **authResetRequestRequest** | **AuthResetRequestRequest**|  | |


### Return type

**AuthResetRequest200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Password reset request processed (always returns success for security) |  -  |
|**400** | Bad request - invalid input parameters |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authWhoAmI**
> AuthWhoAmI200Response authWhoAmI()

**⚠️ DEPRECATED:** This GET endpoint is deprecated due to caching issues. Use the POST method instead.  Returns information about the currently authenticated user.  **Security note:** Only explicitly configured fields are returned, never the complete user object. This prevents accidental exposure of sensitive user data. 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.authWhoAmI();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**AuthWhoAmI200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Current user information retrieved successfully |  -  |
|**401** | Authentication required |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authWhoAmIPost**
> AuthWhoAmI200Response authWhoAmIPost()

Returns information about the currently authenticated user.  **Note:** POST method is recommended for this endpoint to avoid caching issues.  **Perfect for:** - Checking if authentication is working - Getting user details for your app - Validating permissions  **Security note:** Only explicitly configured fields are returned,  never the complete user object. This prevents accidental exposure  of sensitive user data. 

### Example

```typescript
import {
    AuthenticationApi,
    Configuration
} from 'apostrophecms-client';

const configuration = new Configuration();
const apiInstance = new AuthenticationApi(configuration);

const { status, data } = await apiInstance.authWhoAmIPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**AuthWhoAmI200Response**

### Authorization

[SessionAuth](../README.md#SessionAuth), [ApiKeyAuth](../README.md#ApiKeyAuth), [BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Current user information retrieved successfully |  -  |
|**401** | Authentication required |  -  |
|**404** | Resource not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


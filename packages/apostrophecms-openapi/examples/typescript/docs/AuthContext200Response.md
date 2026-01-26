# AuthContext200Response

Additional context based on configuration

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**localLogin** | **boolean** | Whether local login is enabled | [optional] [default to undefined]
**passwordReset** | **boolean** | Whether password reset is enabled | [optional] [default to undefined]
**loginUrl** | **string** | The configured login URL | [optional] [default to undefined]

## Example

```typescript
import { AuthContext200Response } from 'apostrophecms-client';

const instance: AuthContext200Response = {
    localLogin,
    passwordReset,
    loginUrl,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

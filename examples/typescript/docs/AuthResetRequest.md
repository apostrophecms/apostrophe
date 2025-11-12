# AuthResetRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**token** | **string** | Reset token from the password reset email | [default to undefined]
**password** | **string** | New password for the user account | [default to undefined]

## Example

```typescript
import { AuthResetRequest } from 'apostrophecms-client';

const instance: AuthResetRequest = {
    token,
    password,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

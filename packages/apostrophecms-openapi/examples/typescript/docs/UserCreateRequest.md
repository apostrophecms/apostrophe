# UserCreateRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | Display name for the user | [default to undefined]
**username** | **string** | Unique username for login | [default to undefined]
**email** | **string** | User\&#39;s email address | [default to undefined]
**password** | **string** | User\&#39;s password | [optional] [default to undefined]
**firstName** | **string** | User\&#39;s first name | [optional] [default to undefined]
**lastName** | **string** | User\&#39;s last name | [optional] [default to undefined]
**role** | **string** | User\&#39;s role/permission level | [optional] [default to undefined]
**disabled** | **boolean** | Whether the user account is disabled | [optional] [default to false]

## Example

```typescript
import { UserCreateRequest } from 'apostrophecms-client';

const instance: UserCreateRequest = {
    title,
    username,
    email,
    password,
    firstName,
    lastName,
    role,
    disabled,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

# User

Built-in user piece type for account management.  **Base Properties**: Inherited from @apostrophecms/piece-type **User-Specific Properties**: title, username, email, role, disabled  💡 Developers can add custom fields to the user piece type in their project configuration. 

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique identifier | [optional] [default to undefined]
**title** | **string** | User\&#39;s display name | [optional] [default to undefined]
**username** | **string** | Login username (must be unique) | [optional] [default to undefined]
**email** | **string** | User\&#39;s email address | [optional] [default to undefined]
**role** | **string** | User role - determines permissions | [optional] [default to undefined]
**disabled** | **boolean** | Whether the user account is disabled | [optional] [default to false]
**archived** | **boolean** | Whether the user is archived | [optional] [default to false]
**visibility** | **string** | Visibility setting | [optional] [default to VisibilityEnum_LoginRequired]
**type** | **string** |  | [optional] [default to undefined]
**slug** | **string** |  | [optional] [default to undefined]
**createdAt** | **string** | Account creation date | [optional] [default to undefined]
**updatedAt** | **string** | Last update date | [optional] [default to undefined]

## Example

```typescript
import { User } from 'apostrophecms-client';

const instance: User = {
    _id,
    title,
    username,
    email,
    role,
    disabled,
    archived,
    visibility,
    type,
    slug,
    createdAt,
    updatedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

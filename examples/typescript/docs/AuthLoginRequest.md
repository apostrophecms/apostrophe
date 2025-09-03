# AuthLoginRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**username** | **string** | User\&#39;s login username | [default to undefined]
**password** | **string** | User\&#39;s password | [default to undefined]
**session** | **boolean** | Set to true to receive session cookie instead of bearer token | [optional] [default to false]

## Example

```typescript
import { AuthLoginRequest } from 'apostrophecms-client';

const instance: AuthLoginRequest = {
    username,
    password,
    session,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

# AuthWhoAmI200Response

Additional fields based on whoamiFields configuration

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | User\&#39;s unique identifier | [optional] [default to undefined]
**username** | **string** | User\&#39;s login username | [optional] [default to undefined]
**title** | **string** | User\&#39;s display name | [optional] [default to undefined]
**email** | **string** | User\&#39;s email address (if configured in whoamiFields) | [optional] [default to undefined]

## Example

```typescript
import { AuthWhoAmI200Response } from 'apostrophecms-client';

const instance: AuthWhoAmI200Response = {
    _id,
    username,
    title,
    email,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

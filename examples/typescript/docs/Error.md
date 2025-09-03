# ModelError


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **number** | HTTP status code, e.g., 401 | [optional] [default to undefined]
**code** | **string** | Application error code (optional) | [optional] [default to undefined]
**message** | **string** | Human-readable error message | [default to undefined]
**details** | **{ [key: string]: any; }** | Extra context about the error | [optional] [default to undefined]

## Example

```typescript
import { ModelError } from 'apostrophecms-client';

const instance: ModelError = {
    status,
    code,
    message,
    details,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

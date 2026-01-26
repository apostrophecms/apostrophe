# LocaleRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**locale** | **string** | Target locale code | [default to undefined]
**contextDocId** | **string** | Optional document ID for the path | [optional] [default to undefined]
**clipboard** | **string** | Optional clipboard content for cross-domain situations | [optional] [default to undefined]

## Example

```typescript
import { LocaleRequest } from 'apostrophecms-client';

const instance: LocaleRequest = {
    locale,
    contextDocId,
    clipboard,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

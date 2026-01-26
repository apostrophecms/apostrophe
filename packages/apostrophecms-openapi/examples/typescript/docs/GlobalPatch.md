# GlobalPatch

Allows for patching of costom user added fields. It blocks the modification of the title, slu, and type fields. 

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | Default title field | [optional] [readonly] [default to undefined]
**slug** | **string** | Default slug field | [optional] [readonly] [default to undefined]
**type** | **string** |  | [optional] [readonly] [default to undefined]

## Example

```typescript
import { GlobalPatch } from 'apostrophecms-client';

const instance: GlobalPatch = {
    title,
    slug,
    type,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

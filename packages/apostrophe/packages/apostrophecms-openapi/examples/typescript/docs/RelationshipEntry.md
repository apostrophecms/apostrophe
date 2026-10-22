# RelationshipEntry

One relationship entry. Always includes the related document `_id`. If you declared per-relationship `fields`, those values are stored alongside `_id` here. 

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Id of the related document. | [default to undefined]

## Example

```typescript
import { RelationshipEntry } from 'apostrophecms-client';

const instance: RelationshipEntry = {
    _id,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

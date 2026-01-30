# ImageTag

Built-in image tag piece type for organizing images

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** |  | [optional] [default to undefined]
**title** | **string** | Tag name | [optional] [default to undefined]
**slug** | **string** | URL-friendly tag name | [optional] [default to undefined]
**type** | **string** |  | [optional] [default to undefined]
**archived** | **boolean** |  | [optional] [default to false]
**createdAt** | **string** |  | [optional] [default to undefined]
**updatedAt** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { ImageTag } from 'apostrophecms-client';

const instance: ImageTag = {
    _id,
    title,
    slug,
    type,
    archived,
    createdAt,
    updatedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

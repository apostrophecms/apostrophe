# Image

Built-in image/media piece type for managing photos and graphics

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique identifier | [optional] [default to undefined]
**title** | **string** | Image title/alt text | [optional] [default to undefined]
**slug** | **string** |  | [optional] [default to undefined]
**type** | **string** |  | [optional] [default to undefined]
**archived** | **boolean** |  | [optional] [default to false]
**visibility** | **string** |  | [optional] [default to VisibilityEnum_Public]
**attachment** | [**ImageAttachment**](ImageAttachment.md) |  | [optional] [default to undefined]
**credit** | **string** | Image credit or attribution | [optional] [default to undefined]
**tags** | **Array&lt;string&gt;** | Image tags for organization | [optional] [default to undefined]
**createdAt** | **string** |  | [optional] [default to undefined]
**updatedAt** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { Image } from 'apostrophecms-client';

const instance: Image = {
    _id,
    title,
    slug,
    type,
    archived,
    visibility,
    attachment,
    credit,
    tags,
    createdAt,
    updatedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

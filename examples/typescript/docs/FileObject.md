# FileObject

Built-in file piece type for general file uploads (PDFs, documents, etc.)

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique identifier | [optional] [default to undefined]
**title** | **string** | File title/description | [optional] [default to undefined]
**slug** | **string** |  | [optional] [default to undefined]
**type** | **string** |  | [optional] [default to undefined]
**archived** | **boolean** |  | [optional] [default to false]
**visibility** | **string** |  | [optional] [default to VisibilityEnum_Public]
**attachment** | [**FileObjectAttachment**](FileObjectAttachment.md) |  | [optional] [default to undefined]
**description** | **string** | File description | [optional] [default to undefined]
**tags** | **Array&lt;string&gt;** | File tags for organization | [optional] [default to undefined]
**createdAt** | **string** |  | [optional] [default to undefined]
**updatedAt** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { FileObject } from 'apostrophecms-client';

const instance: FileObject = {
    _id,
    title,
    slug,
    type,
    archived,
    visibility,
    attachment,
    description,
    tags,
    createdAt,
    updatedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

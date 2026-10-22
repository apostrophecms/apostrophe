# FileObjectAttachment

File attachment information

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** |  | [optional] [default to undefined]
**name** | **string** |  | [optional] [default to undefined]
**extension** | **string** |  | [optional] [default to undefined]
**length** | **number** | File size in bytes | [optional] [default to undefined]
**url** | **string** | Public URL to access the file | [optional] [default to undefined]

## Example

```typescript
import { FileObjectAttachment } from 'apostrophecms-client';

const instance: FileObjectAttachment = {
    _id,
    name,
    extension,
    length,
    url,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

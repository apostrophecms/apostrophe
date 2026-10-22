# ImagePostRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** |  | [default to undefined]
**attachment** | [**Attachment**](Attachment.md) | Attachment object from upload endpoint | [default to undefined]
**alt** | **string** | Alt text for accessibility | [optional] [default to undefined]
**credit** | **string** | Photo credit | [optional] [default to undefined]

## Example

```typescript
import { ImagePostRequest } from 'apostrophecms-client';

const instance: ImagePostRequest = {
    title,
    attachment,
    alt,
    credit,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

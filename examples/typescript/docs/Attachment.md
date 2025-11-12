# Attachment

File attachment information from upload endpoint

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique attachment identifier | [optional] [default to undefined]
**_url** | **string** | URL to the original file | [optional] [default to undefined]
**_urls** | **{ [key: string]: string; }** | URLs for different image sizes (images only) | [optional] [default to undefined]
**name** | **string** | Slugified filename | [optional] [default to undefined]
**title** | **string** | Sortified filename | [optional] [default to undefined]
**extension** | **string** | File extension | [optional] [default to undefined]
**type** | **string** |  | [optional] [default to undefined]
**group** | **string** | File group type | [optional] [default to undefined]
**length** | **number** | File size in bytes | [optional] [default to undefined]
**md5** | **string** | MD5 checksum | [optional] [default to undefined]
**width** | **number** | Image width in pixels (images only) | [optional] [default to undefined]
**height** | **number** | Image height in pixels (images only) | [optional] [default to undefined]
**landscape** | **boolean** | Whether image is landscape orientation (images only) | [optional] [default to undefined]
**portrait** | **boolean** | Whether image is portrait orientation (images only) | [optional] [default to undefined]
**docIds** | **Array&lt;string&gt;** | IDs of documents using this attachment | [optional] [default to undefined]
**archivedDocIds** | **Array&lt;string&gt;** | IDs of archived documents using this attachment | [optional] [default to undefined]
**createdAt** | **string** |  | [optional] [default to undefined]
**updatedAt** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { Attachment } from 'apostrophecms-client';

const instance: Attachment = {
    _id,
    _url,
    _urls,
    name,
    title,
    extension,
    type,
    group,
    length,
    md5,
    width,
    height,
    landscape,
    portrait,
    docIds,
    archivedDocIds,
    createdAt,
    updatedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

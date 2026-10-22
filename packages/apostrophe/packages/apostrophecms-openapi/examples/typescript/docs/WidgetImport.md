# WidgetImport

Import configuration for external content (used during creation/update)

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**baseUrl** | **string** | Base URL for resolving relative image URLs | [optional] [default to undefined]
**html** | **string** | HTML content to import (images will be automatically imported) | [optional] [default to undefined]
**imageTags** | **Array&lt;string&gt;** | Array of existing @apostrophecms/image-tag piece _ids to apply to imported images | [optional] [default to undefined]

## Example

```typescript
import { WidgetImport } from 'apostrophecms-client';

const instance: WidgetImport = {
    baseUrl,
    html,
    imageTags,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

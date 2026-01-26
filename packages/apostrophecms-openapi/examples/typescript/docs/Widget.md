# Widget

Content widget within an area - represents a piece of structured content

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** |  | [optional] [default to undefined]
**metaType** | **string** |  | [optional] [default to undefined]
**type** | **string** | Widget type (e.g., rich-text, image, custom widgets) | [optional] [default to undefined]
**_edit** | **boolean** |  | [optional] [default to undefined]
**_docId** | **string** |  | [optional] [default to undefined]
**content** | **string** | HTML content for rich text widgets (filtered based on widget configuration) | [optional] [default to undefined]
**_import** | [**WidgetImport**](WidgetImport.md) |  | [optional] [default to undefined]

## Example

```typescript
import { Widget } from 'apostrophecms-client';

const instance: Widget = {
    _id,
    metaType,
    type,
    _edit,
    _docId,
    content,
    _import,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

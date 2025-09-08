# AreaOptions


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**widgets** | **{ [key: string]: object; }** | Allowed widget types for this area. Keys are widget module names (e.g., \&quot;@apostrophecms/rich-text\&quot;). Values are per-widget options that apply *only* in this area.  | [default to undefined]
**groups** | [**{ [key: string]: AreaWidgetGroup; }**](AreaWidgetGroup.md) | Organize widgets into groups for the expanded preview menu. Each group has a label, optional columns (1–4, default 3), and its own widgets map (same shape as &#x60;widgets&#x60;).  | [optional] [default to undefined]
**max** | **number** | Maximum number of widgets allowed in this area. | [optional] [default to undefined]
**expanded** | **boolean** | Use the expanded preview menu UX. | [optional] [default to undefined]

## Example

```typescript
import { AreaOptions } from 'apostrophecms-client';

const instance: AreaOptions = {
    widgets,
    groups,
    max,
    expanded,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

# RelationshipField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Apostrophe field type id. | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | **any** |  | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**withType** | **string** | Module name of the related doc type (e.g., \&quot;article\&quot;, \&quot;@apostrophecms/image\&quot;). | [default to undefined]
**min** | **number** | Minimum number of related docs required (inclusive). | [optional] [default to undefined]
**max** | **number** | Maximum number of related docs allowed (inclusive). | [optional] [default to undefined]
**fields** | [**Fieldset**](Fieldset.md) |  | [optional] [default to undefined]
**builders** | **{ [key: string]: any; }** | Apostrophe cursor builders for the related query (e.g., {project: { title: 1 }, sort: { title: 1 } }).  | [optional] [default to undefined]

## Example

```typescript
import { RelationshipField } from 'apostrophecms-client';

const instance: RelationshipField = {
    type,
    label,
    help,
    htmlHelp,
    def,
    required,
    readOnly,
    hidden,
    _if,
    requiredIf,
    withType,
    min,
    max,
    fields,
    builders,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

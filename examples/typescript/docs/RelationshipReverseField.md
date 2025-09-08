# RelationshipReverseField


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
**withType** | **string** | Module name that holds the forward relationship. | [default to undefined]
**reverseOf** | **string** | Name of the forward relationship field on &#x60;withType&#x60; (e.g.,\&quot;_authors\&quot; on \&quot;article\&quot;).  | [default to undefined]
**builders** | **{ [key: string]: any; }** | Cursor builders applied when populating the reverse join. | [optional] [default to undefined]

## Example

```typescript
import { RelationshipReverseField } from 'apostrophecms-client';

const instance: RelationshipReverseField = {
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
    reverseOf,
    builders,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

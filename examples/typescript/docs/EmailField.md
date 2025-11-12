# EmailField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Apostrophe field type id. | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | **string** | Default email address shown in the editor UI. | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**pattern** | **string** | Optional regex for stricter validation (in addition to HTML5 email validation). | [optional] [default to undefined]
**autocomplete** | **string** | Value for the HTML autocomplete attribute. Common values are \&quot;email\&quot; or \&quot;off\&quot;. | [optional] [default to undefined]

## Example

```typescript
import { EmailField } from 'apostrophecms-client';

const instance: EmailField = {
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
    pattern,
    autocomplete,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

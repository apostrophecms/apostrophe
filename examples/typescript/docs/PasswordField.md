# PasswordField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Apostrophe field type id. | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | **string** | Default password value (generally not used). | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**min** | **number** | Minimum number of characters required. | [optional] [default to undefined]
**max** | **number** | Maximum number of characters allowed. | [optional] [default to undefined]
**pattern** | **string** | Regex to enforce password rules (e.g., at least one number). | [optional] [default to undefined]
**autocomplete** | **string** | HTML autocomplete attribute, usually \&quot;new-password\&quot; or \&quot;current-password\&quot;. | [optional] [default to undefined]

## Example

```typescript
import { PasswordField } from 'apostrophecms-client';

const instance: PasswordField = {
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
    min,
    max,
    pattern,
    autocomplete,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

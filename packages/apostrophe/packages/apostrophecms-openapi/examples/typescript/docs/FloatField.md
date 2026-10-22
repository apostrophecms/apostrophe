# FloatField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** |  | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | **number** | Default decimal value. | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**min** | **number** | Minimum allowed value (inclusive). | [optional] [default to undefined]
**max** | **number** | Maximum allowed value (inclusive) | [optional] [default to undefined]
**format** | **string** | OpenAPI hint for tooling; always \&quot;float\&quot;. | [optional] [default to undefined]

## Example

```typescript
import { FloatField } from 'apostrophecms-client';

const instance: FloatField = {
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
    format,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

# SelectField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Apostrophe field type id. | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | [**SelectFieldAllOfDef**](SelectFieldAllOfDef.md) |  | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**multiple** | **boolean** | Allow selecting multiple values (stores an array). | [optional] [default to undefined]
**choices** | [**SelectFieldAllOfChoices**](SelectFieldAllOfChoices.md) |  | [optional] [default to undefined]
**following** | [**SelectFieldAllOfFollowing**](SelectFieldAllOfFollowing.md) |  | [optional] [default to undefined]
**followingIgnore** | [**SelectFieldAllOfFollowingIgnore**](SelectFieldAllOfFollowingIgnore.md) |  | [optional] [default to undefined]

## Example

```typescript
import { SelectField } from 'apostrophecms-client';

const instance: SelectField = {
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
    multiple,
    choices,
    following,
    followingIgnore,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

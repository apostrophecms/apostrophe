# RadioField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Apostrophe field type id. | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | [**RadioFieldAllOfDef**](RadioFieldAllOfDef.md) |  | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**choices** | [**RadioFieldAllOfChoices**](RadioFieldAllOfChoices.md) |  | [default to undefined]
**following** | [**RadioFieldAllOfFollowing**](RadioFieldAllOfFollowing.md) |  | [optional] [default to undefined]
**followingIgnore** | [**RadioFieldAllOfFollowingIgnore**](RadioFieldAllOfFollowingIgnore.md) |  | [optional] [default to undefined]

## Example

```typescript
import { RadioField } from 'apostrophecms-client';

const instance: RadioField = {
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
    choices,
    following,
    followingIgnore,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

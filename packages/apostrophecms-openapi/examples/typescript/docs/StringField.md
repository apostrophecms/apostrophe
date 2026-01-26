# StringField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Apostrophe field type id. | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | **string** | Default value shown in the editor UI. | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**textarea** | **boolean** | If true, renders a multiline textarea UI. | [optional] [default to undefined]
**min** | **number** | Minimum number of characters allowed. | [optional] [default to undefined]
**max** | **number** | Maximum number of characters allowed. | [optional] [default to undefined]
**pattern** | **string** | Regular expression (string form) to validate the input. Only matching values are allowed.  | [optional] [default to undefined]
**autocomplete** | **string** | Value of the HTML autocomplete attribute (see MDN). Use &#x60;\&quot;off\&quot;&#x60; to disable autocomplete.  | [optional] [default to undefined]
**following** | [**StringFieldAllOfFollowing**](StringFieldAllOfFollowing.md) |  | [optional] [default to undefined]
**followingIgnore** | [**StringFieldAllOfFollowingIgnore**](StringFieldAllOfFollowingIgnore.md) |  | [optional] [default to undefined]
**sortify** | **boolean** | If true, creates a parallel “sortified” version of this field for case- and punctuation-insensitive sorting. | [optional] [default to undefined]

## Example

```typescript
import { StringField } from 'apostrophecms-client';

const instance: StringField = {
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
    textarea,
    min,
    max,
    pattern,
    autocomplete,
    following,
    followingIgnore,
    sortify,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

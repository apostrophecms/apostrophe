# SlugField


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Apostrophe field type id. | [default to undefined]
**label** | **string** | Human-readable label for editors. | [default to undefined]
**help** | **string** | Short helper text shown in the UI. | [optional] [default to undefined]
**htmlHelp** | **string** | Rich helper text (HTML allowed by Apostrophe). | [optional] [default to undefined]
**def** | **string** | Default slug value shown in the editor UI. | [optional] [default to undefined]
**required** | **boolean** | If true, value must be provided. | [optional] [default to undefined]
**readOnly** | **boolean** | If true, UI should render as read-only (Apostrophe option). | [optional] [default to undefined]
**hidden** | **boolean** | If true, hide in editor UI. | [optional] [default to undefined]
**_if** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**requiredIf** | [**UiCondition**](UiCondition.md) |  | [optional] [default to undefined]
**prefix** | **string** | Optional prefix automatically prepended when generating the slug. | [optional] [default to undefined]
**source** | **string** | Name of the field this slug should follow (usually \&quot;title\&quot;). Works with &#x60;following&#x60;/&#x60;followingIgnore&#x60;.  | [optional] [default to undefined]
**unique** | **boolean** | If true, ensures slug is unique across docs of this type. | [optional] [default to undefined]
**pattern** | **string** | Optional regex to further constrain allowed slugs. | [optional] [default to undefined]

## Example

```typescript
import { SlugField } from 'apostrophecms-client';

const instance: SlugField = {
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
    prefix,
    source,
    unique,
    pattern,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

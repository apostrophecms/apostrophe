# FieldDefinition


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
**toggle** | [**BooleanFieldAllOfToggle**](BooleanFieldAllOfToggle.md) |  | [optional] [default to undefined]
**textarea** | **boolean** | If true, renders a multiline textarea UI. | [optional] [default to undefined]
**min** | **number** | Minimum number of related docs required (inclusive). | [optional] [default to undefined]
**max** | **number** | Maximum number of related docs allowed (inclusive). | [optional] [default to undefined]
**pattern** | **string** | Optional regex to further constrain allowed slugs. | [optional] [default to undefined]
**autocomplete** | **string** | Value for the HTML autocomplete attribute. Common values include \&quot;url\&quot; or \&quot;off\&quot;. | [optional] [default to undefined]
**following** | [**CheckboxesFieldAllOfFollowing**](CheckboxesFieldAllOfFollowing.md) |  | [optional] [default to undefined]
**followingIgnore** | [**CheckboxesFieldAllOfFollowingIgnore**](CheckboxesFieldAllOfFollowingIgnore.md) |  | [optional] [default to undefined]
**sortify** | **boolean** | If true, creates a parallel “sortified” version of this field for case- and punctuation-insensitive sorting. | [optional] [default to undefined]
**format** | **string** | OpenAPI hint for tooling; always \&quot;float\&quot;. | [optional] [default to undefined]
**multiple** | **boolean** | Allow selecting multiple values (stores an array). | [optional] [default to undefined]
**choices** | [**CheckboxesFieldAllOfChoices**](CheckboxesFieldAllOfChoices.md) |  | [default to undefined]
**prefix** | **string** | Optional prefix automatically prepended when generating the slug. | [optional] [default to undefined]
**source** | **string** | Name of the field this slug should follow (usually \&quot;title\&quot;). Works with &#x60;following&#x60;/&#x60;followingIgnore&#x60;.  | [optional] [default to undefined]
**unique** | **boolean** | If true, ensures slug is unique across docs of this type. | [optional] [default to undefined]
**step** | **number** | Increment step for the slider. If omitted, defaults to 1. | [optional] [default to undefined]
**fields** | [**Fieldset**](Fieldset.md) |  | [default to undefined]
**titleField** | **string** | Field name in each item used as the item label in the UI. | [optional] [default to undefined]
**_options** | [**AreaOptions**](AreaOptions.md) |  | [default to undefined]
**accept** | [**AttachmentFieldAllOfAccept**](AttachmentFieldAllOfAccept.md) |  | [optional] [default to undefined]
**maxSize** | **number** | Optional max file size in bytes (documentation-only hint). | [optional] [default to undefined]
**withType** | **string** | Module name that holds the forward relationship. | [default to undefined]
**builders** | **{ [key: string]: any; }** | Cursor builders applied when populating the reverse join. | [optional] [default to undefined]
**reverseOf** | **string** | Name of the forward relationship field on &#x60;withType&#x60; (e.g.,\&quot;_authors\&quot; on \&quot;article\&quot;).  | [default to undefined]

## Example

```typescript
import { FieldDefinition } from 'apostrophecms-client';

const instance: FieldDefinition = {
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
    toggle,
    textarea,
    min,
    max,
    pattern,
    autocomplete,
    following,
    followingIgnore,
    sortify,
    format,
    multiple,
    choices,
    prefix,
    source,
    unique,
    step,
    fields,
    titleField,
    _options,
    accept,
    maxSize,
    withType,
    builders,
    reverseOf,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

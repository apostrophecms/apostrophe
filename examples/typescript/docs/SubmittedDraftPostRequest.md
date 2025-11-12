# SubmittedDraftPostRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | Title of the submitted draft | [optional] [default to undefined]
**content** | **string** | Content of the submitted draft | [optional] [default to undefined]
**author** | **string** | Author of the submitted draft | [optional] [default to undefined]
**submissionNotes** | **string** | Notes from the submitter about the draft | [optional] [default to undefined]
**priority** | **string** | Priority level for review | [optional] [default to PriorityEnum_Normal]
**category** | **string** | Category or type of content being submitted | [optional] [default to undefined]

## Example

```typescript
import { SubmittedDraftPostRequest } from 'apostrophecms-client';

const instance: SubmittedDraftPostRequest = {
    title,
    content,
    author,
    submissionNotes,
    priority,
    category,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

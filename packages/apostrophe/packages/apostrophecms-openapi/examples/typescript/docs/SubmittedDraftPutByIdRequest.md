# SubmittedDraftPutByIdRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | Title of the submitted draft | [default to undefined]
**content** | **string** | Content of the submitted draft | [default to undefined]
**author** | **string** | Author of the submitted draft | [optional] [default to undefined]
**submissionNotes** | **string** | Notes about the submission | [optional] [default to undefined]
**priority** | **string** | Priority level for review | [optional] [default to PriorityEnum_Normal]

## Example

```typescript
import { SubmittedDraftPutByIdRequest } from 'apostrophecms-client';

const instance: SubmittedDraftPutByIdRequest = {
    title,
    content,
    author,
    submissionNotes,
    priority,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

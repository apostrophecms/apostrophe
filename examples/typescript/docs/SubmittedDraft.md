# SubmittedDraft


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique identifier for the submitted draft | [default to undefined]
**type** | **string** | Document type identifier | [default to undefined]
**title** | **string** | Title of the submitted draft | [default to undefined]
**slug** | **string** | URL-friendly version of the title | [optional] [default to undefined]
**content** | **string** | Content of the submitted draft | [default to undefined]
**author** | **string** | Author of the submitted draft | [default to undefined]
**authorId** | **string** | ID of the user who created the draft | [optional] [default to undefined]
**submissionNotes** | **string** | Notes from the submitter about the draft | [optional] [default to undefined]
**priority** | **string** | Priority level for review | [optional] [default to undefined]
**category** | **string** | Category or type of content being submitted | [optional] [default to undefined]
**status** | **string** | Current status of the submitted draft | [default to undefined]
**submittedAt** | **string** | When the draft was submitted for review | [optional] [default to undefined]
**reviewedAt** | **string** | When the draft was last reviewed | [optional] [default to undefined]
**reviewedBy** | **string** | ID of the user who reviewed the draft | [optional] [default to undefined]
**reviewNotes** | **string** | Notes from the reviewer | [optional] [default to undefined]
**publishedAt** | **string** | When the draft was published (if applicable) | [optional] [default to undefined]
**archived** | **boolean** | Whether the submitted draft is archived | [optional] [default to false]
**createdAt** | **string** | When the submitted draft was created | [default to undefined]
**updatedAt** | **string** | When the submitted draft was last updated | [default to undefined]
**aposLocale** | **string** | Locale for this version of the content | [optional] [default to undefined]
**aposMode** | **string** | Content mode (draft or published) | [optional] [default to undefined]

## Example

```typescript
import { SubmittedDraft } from 'apostrophecms-client';

const instance: SubmittedDraft = {
    _id,
    type,
    title,
    slug,
    content,
    author,
    authorId,
    submissionNotes,
    priority,
    category,
    status,
    submittedAt,
    reviewedAt,
    reviewedBy,
    reviewNotes,
    publishedAt,
    archived,
    createdAt,
    updatedAt,
    aposLocale,
    aposMode,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

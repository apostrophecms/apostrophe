# PaginatedResponseData


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**results** | **Array&lt;object&gt;** |  | [optional] [default to undefined]
**pages** | **number** | Total number of pages | [optional] [default to undefined]
**currentPage** | **number** | Current page number (1-based) | [optional] [default to undefined]
**total** | **number** | Total number of items across all pages | [optional] [default to undefined]

## Example

```typescript
import { PaginatedResponseData } from 'apostrophecms-client';

const instance: PaginatedResponseData = {
    results,
    pages,
    currentPage,
    total,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

# PagePutByIdRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_targetId** | **string** | ID of target page for positioning (_home and _archive are convenience values) | [default to undefined]
**_position** | [**PageCreateRequestPosition**](PageCreateRequestPosition.md) |  | [default to undefined]
**_copyingId** | **string** | Optional ID of existing page to copy properties from | [optional] [default to undefined]
**title** | **string** | Page title | [default to undefined]
**slug** | **string** | URL slug (auto-generated if not provided) | [optional] [default to undefined]
**type** | **string** | Page type (must be configured in your project) | [optional] [default to undefined]
**visibility** | **string** | Who can view this page | [optional] [default to VisibilityEnum_Public]

## Example

```typescript
import { PagePutByIdRequest } from 'apostrophecms-client';

const instance: PagePutByIdRequest = {
    _targetId,
    _position,
    _copyingId,
    title,
    slug,
    type,
    visibility,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

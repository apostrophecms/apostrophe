# PageUpdateRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_targetId** | **string** | ID of target page for repositioning (required if moving page) | [optional] [default to undefined]
**_position** | [**PageUpdateRequestPosition**](PageUpdateRequestPosition.md) |  | [optional] [default to undefined]
**title** | **string** | Updated page title | [optional] [default to undefined]
**slug** | **string** | Updated URL slug | [optional] [default to undefined]
**visibility** | **string** | Updated visibility setting | [optional] [default to undefined]
**updatedBy** | [**User**](User.md) |  | [optional] [default to undefined]

## Example

```typescript
import { PageUpdateRequest } from 'apostrophecms-client';

const instance: PageUpdateRequest = {
    _targetId,
    _position,
    title,
    slug,
    visibility,
    updatedBy,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

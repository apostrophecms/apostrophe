# CreatePieceRequest

Generic structure for creating any piece type

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | Piece title (required for all piece types) | [default to undefined]
**slug** | **string** | URL slug (auto-generated from title if not provided) | [optional] [default to undefined]
**visibility** | **string** | Visibility setting | [optional] [default to VisibilityEnum_Public]
**archived** | **boolean** | Whether the piece is archived | [optional] [default to false]

## Example

```typescript
import { CreatePieceRequest } from 'apostrophecms-client';

const instance: CreatePieceRequest = {
    title,
    slug,
    visibility,
    archived,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

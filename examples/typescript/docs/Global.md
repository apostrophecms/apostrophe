# Global

\'Built-in global content piece type for site-wide settings.  💡 Developers can add custom fields to the global piece type in their project configuration. 

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique identifier | [optional] [default to undefined]
**title** | **string** | Default title field | [optional] [readonly] [default to undefined]
**slug** | **string** | Default slug field | [optional] [readonly] [default to undefined]
**type** | **string** |  | [optional] [readonly] [default to undefined]

## Example

```typescript
import { Global } from 'apostrophecms-client';

const instance: Global = {
    _id,
    title,
    slug,
    type,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

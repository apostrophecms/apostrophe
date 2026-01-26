# PageSeoFields

SEO metadata for the page

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**metaDescription** | **string** | Meta description for search engines | [optional] [default to undefined]
**metaKeywords** | **string** | Meta keywords (legacy, rarely used) | [optional] [default to undefined]
**ogTitle** | **string** | Open Graph title for social sharing | [optional] [default to undefined]
**ogDescription** | **string** | Open Graph description for social sharing | [optional] [default to undefined]
**ogImage** | [**PageSeoFieldsOgImage**](PageSeoFieldsOgImage.md) |  | [optional] [default to undefined]

## Example

```typescript
import { PageSeoFields } from 'apostrophecms-client';

const instance: PageSeoFields = {
    metaDescription,
    metaKeywords,
    ogTitle,
    ogDescription,
    ogImage,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

# GlobalPostRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | Global content title | [optional] [default to undefined]
**footerContent** | **string** | Footer content that appears on all pages | [optional] [default to undefined]
**contactInfo** | [**GlobalPostRequestContactInfo**](GlobalPostRequestContactInfo.md) |  | [optional] [default to undefined]
**socialMedia** | [**GlobalPostRequestSocialMedia**](GlobalPostRequestSocialMedia.md) |  | [optional] [default to undefined]
**siteSettings** | [**GlobalPostRequestSiteSettings**](GlobalPostRequestSiteSettings.md) |  | [optional] [default to undefined]

## Example

```typescript
import { GlobalPostRequest } from 'apostrophecms-client';

const instance: GlobalPostRequest = {
    title,
    footerContent,
    contactInfo,
    socialMedia,
    siteSettings,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

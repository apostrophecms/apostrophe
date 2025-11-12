# Page

An ApostropheCMS page document with hierarchical structure and content areas

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique document identifier, may include mode and locale (e.g., \&quot;id:en:published\&quot;) | [default to undefined]
**aposDocId** | **string** | Base document ID without mode/locale qualifiers | [default to undefined]
**aposLocale** | **string** | Document locale code | [optional] [default to undefined]
**aposMode** | **string** | Document mode (draft or published) | [optional] [default to undefined]
**archived** | **boolean** | Whether the page is archived | [optional] [default to false]
**createdAt** | **string** | Page creation timestamp | [optional] [default to undefined]
**updatedAt** | **string** | Page last update timestamp | [optional] [default to undefined]
**titleSortified** | **string** | Sortable version of the page title | [optional] [default to undefined]
**slug** | **string** | URL slug for the page | [default to undefined]
**path** | **string** | Full hierarchical path in the page tree | [default to undefined]
**rank** | **number** | Sort order within parent page | [optional] [default to undefined]
**level** | **number** | Depth level in the page tree (0 &#x3D; root level) | [default to undefined]
**orphan** | **boolean** | Whether page is orphaned (not in tree structure) | [optional] [default to false]
**parked** | **Array&lt;string&gt;** | Array of parking lot configurations if page is parked | [optional] [default to undefined]
**visibility** | **string** | Page visibility setting | [optional] [default to VisibilityEnum_Public]
**type** | **string** | Page type module name | [default to undefined]
**title** | **string** | Page title | [default to undefined]
**main** | [**PageMain**](PageMain.md) |  | [optional] [default to undefined]
**seoFields** | [**PageSeoFields**](PageSeoFields.md) |  | [optional] [default to undefined]
**_ancestors** | **Array&lt;string&gt;** | Array of ancestor page IDs in the page tree hierarchy | [optional] [default to undefined]
**_children** | [**Array&lt;Page&gt;**](Page.md) | Array of child pages (when requested with children parameter) | [optional] [default to undefined]
**_url** | **string** | Full URL to the page | [optional] [default to undefined]
**_edit** | **boolean** | Whether current user can edit this page | [optional] [default to undefined]
**_publish** | **boolean** | Whether current user can publish this page | [optional] [default to undefined]
**_publishedDoc** | [**Page**](Page.md) | Published version of the page (when viewing drafts) | [optional] [default to undefined]
**_draftDoc** | [**Page**](Page.md) | Draft version of the page (when viewing published) | [optional] [default to undefined]

## Example

```typescript
import { Page } from 'apostrophecms-client';

const instance: Page = {
    _id,
    aposDocId,
    aposLocale,
    aposMode,
    archived,
    createdAt,
    updatedAt,
    titleSortified,
    slug,
    path,
    rank,
    level,
    orphan,
    parked,
    visibility,
    type,
    title,
    main,
    seoFields,
    _ancestors,
    _children,
    _url,
    _edit,
    _publish,
    _publishedDoc,
    _draftDoc,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

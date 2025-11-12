# FlatPageResponseResultsInner


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**_id** | **string** | Unique document identifier | [optional] [default to undefined]
**orphan** | **boolean** | Whether page is excluded from navigation menus | [optional] [default to undefined]
**visibility** | **string** | Page visibility setting - controls who can view this page | [optional] [default to undefined]
**type** | **string** | Page type identifier (configured in your project) | [optional] [default to undefined]
**title** | **string** | Page title - used for navigation and SEO | [optional] [default to undefined]
**slug** | **string** | URL slug for the page | [optional] [default to undefined]
**rank** | **number** | Order among sibling pages (for navigation sorting) | [optional] [default to undefined]
**level** | **number** | Page tree depth level (0 &#x3D; home page) | [optional] [default to undefined]
**path** | **string** | Ancestor path of page IDs | [optional] [default to undefined]
**_url** | **string** | Complete page URL - use this for links | [optional] [default to undefined]
**_ancestors** | **Array&lt;string&gt;** | Array of ancestor page IDs (in flat response) | [optional] [default to undefined]
**_children** | **Array&lt;string&gt;** | Array of child page IDs (in flat response) | [optional] [default to undefined]
**createdAt** | **string** | ISO date of creation | [optional] [default to undefined]
**updatedAt** | **string** | ISO date of last update | [optional] [default to undefined]
**archived** | **boolean** | Whether page is archived (hidden from normal views) | [optional] [default to undefined]
**historicUrls** | **Array&lt;string&gt;** | Previous URLs that redirect to this page (SEO preservation) | [optional] [default to undefined]
**metaType** | **string** |  | [optional] [default to undefined]
**titleSortified** | **string** | Sortable version of title | [optional] [default to undefined]
**updatedBy** | [**User**](User.md) |  | [optional] [default to undefined]
**_edit** | **boolean** | Whether current user can edit this page | [optional] [default to undefined]

## Example

```typescript
import { FlatPageResponseResultsInner } from 'apostrophecms-client';

const instance: FlatPageResponseResultsInner = {
    _id,
    orphan,
    visibility,
    type,
    title,
    slug,
    rank,
    level,
    path,
    _url,
    _ancestors,
    _children,
    createdAt,
    updatedAt,
    archived,
    historicUrls,
    metaType,
    titleSortified,
    updatedBy,
    _edit,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

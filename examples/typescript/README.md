## apostrophecms-client@1.0.0

This generator creates TypeScript/JavaScript client that utilizes [axios](https://github.com/axios/axios). The generated Node module can be used in the following environments:

Environment
* Node.js
* Webpack
* Browserify

Language level
* ES5 - you must have a Promises/A+ library installed
* ES6

Module system
* CommonJS
* ES6 module system

It can be used in both TypeScript and JavaScript. In TypeScript, the definition will be automatically resolved via `package.json`. ([Reference](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html))

### Building

To build and compile the typescript sources to javascript use:
```
npm install
npm run build
```

### Publishing

First build the package then run `npm publish`

### Consuming

navigate to the folder of your consuming project and run one of the following commands.

_published:_

```
npm install apostrophecms-client@1.0.0 --save
```

_unPublished (not recommended):_

```
npm install PATH_TO_GENERATED_PACKAGE --save
```

### Documentation for API Endpoints

All URIs are relative to *http://localhost:3000/api/v1*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*AttachmentsApi* | [**attachmentCrop**](docs/AttachmentsApi.md#attachmentcrop) | **POST** /@apostrophecms/attachment/crop | Crop image attachment
*AttachmentsApi* | [**attachmentUpload**](docs/AttachmentsApi.md#attachmentupload) | **POST** /@apostrophecms/attachment/upload | Upload media file
*AuthenticationApi* | [**authContext**](docs/AuthenticationApi.md#authcontext) | **GET** /@apostrophecms/login/context | Get login context information
*AuthenticationApi* | [**authContextPost**](docs/AuthenticationApi.md#authcontextpost) | **POST** /@apostrophecms/login/context | Get login context information
*AuthenticationApi* | [**authLogin**](docs/AuthenticationApi.md#authlogin) | **POST** /@apostrophecms/login/login | Login to get authentication token
*AuthenticationApi* | [**authLogout**](docs/AuthenticationApi.md#authlogout) | **POST** /@apostrophecms/login/logout | Logout and invalidate session
*AuthenticationApi* | [**authReset**](docs/AuthenticationApi.md#authreset) | **POST** /@apostrophecms/login/reset | Complete password reset
*AuthenticationApi* | [**authResetRequest**](docs/AuthenticationApi.md#authresetrequest) | **POST** /@apostrophecms/login/reset-request | Request password reset
*AuthenticationApi* | [**authWhoAmI**](docs/AuthenticationApi.md#authwhoami) | **GET** /@apostrophecms/login/whoami | Get current user information
*AuthenticationApi* | [**authWhoAmIPost**](docs/AuthenticationApi.md#authwhoamipost) | **POST** /@apostrophecms/login/whoami | Get current user information
*GlobalContentApi* | [**globalArchive**](docs/GlobalContentApi.md#globalarchive) | **POST** /@apostrophecms/global/archive | Archive global document
*GlobalContentApi* | [**globalDeleteById**](docs/GlobalContentApi.md#globaldeletebyid) | **DELETE** /@apostrophecms/global/{_id} | Delete global document
*GlobalContentApi* | [**globalDismissSubmissionById**](docs/GlobalContentApi.md#globaldismisssubmissionbyid) | **POST** /@apostrophecms/global/{_id}/dismiss-submission | Dismiss global submission
*GlobalContentApi* | [**globalGet**](docs/GlobalContentApi.md#globalget) | **GET** /@apostrophecms/global | Get global content
*GlobalContentApi* | [**globalGetById**](docs/GlobalContentApi.md#globalgetbyid) | **GET** /@apostrophecms/global/{_id} | Get global document
*GlobalContentApi* | [**globalGetLocaleById**](docs/GlobalContentApi.md#globalgetlocalebyid) | **GET** /@apostrophecms/global/{_id}/locale/{toLocale} | Get global document locale
*GlobalContentApi* | [**globalGetLocalesById**](docs/GlobalContentApi.md#globalgetlocalesbyid) | **GET** /@apostrophecms/global/{_id}/locales | Get global document locales
*GlobalContentApi* | [**globalLocalize**](docs/GlobalContentApi.md#globallocalize) | **POST** /@apostrophecms/global/localize | Localize global document
*GlobalContentApi* | [**globalLocalizeById**](docs/GlobalContentApi.md#globallocalizebyid) | **POST** /@apostrophecms/global/{_id}/localize | Localize global document
*GlobalContentApi* | [**globalPatchById**](docs/GlobalContentApi.md#globalpatchbyid) | **PATCH** /@apostrophecms/global/{_id} | Update global document
*GlobalContentApi* | [**globalPost**](docs/GlobalContentApi.md#globalpost) | **POST** /@apostrophecms/global | Update global content
*GlobalContentApi* | [**globalPublish**](docs/GlobalContentApi.md#globalpublish) | **POST** /@apostrophecms/global/publish | Publish global document
*GlobalContentApi* | [**globalPublishById**](docs/GlobalContentApi.md#globalpublishbyid) | **POST** /@apostrophecms/global/{_id}/publish | Publish global document
*GlobalContentApi* | [**globalPutById**](docs/GlobalContentApi.md#globalputbyid) | **PUT** /@apostrophecms/global/{_id} | Replace global document
*GlobalContentApi* | [**globalRestore**](docs/GlobalContentApi.md#globalrestore) | **POST** /@apostrophecms/global/restore | Restore global document
*GlobalContentApi* | [**globalRevertDraftToPublishedById**](docs/GlobalContentApi.md#globalrevertdrafttopublishedbyid) | **POST** /@apostrophecms/global/{_id}/revert-draft-to-published | Revert draft to published
*GlobalContentApi* | [**globalRevertPublishedToPreviousById**](docs/GlobalContentApi.md#globalrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/global/{_id}/revert-published-to-previous | Revert published to previous
*GlobalContentApi* | [**globalShareById**](docs/GlobalContentApi.md#globalsharebyid) | **POST** /@apostrophecms/global/{_id}/share | Share global document
*GlobalContentApi* | [**globalSubmitById**](docs/GlobalContentApi.md#globalsubmitbyid) | **POST** /@apostrophecms/global/{_id}/submit | Submit global document
*GlobalContentApi* | [**globalUnpublishById**](docs/GlobalContentApi.md#globalunpublishbyid) | **POST** /@apostrophecms/global/{_id}/unpublish | Unpublish global document
*InternationalizationApi* | [**i18nExistsPost**](docs/InternationalizationApi.md#i18nexistspost) | **POST** /@apostrophecms/i18n/exist-in-locale | Check document existence in locale
*InternationalizationApi* | [**i18nLocalePost**](docs/InternationalizationApi.md#i18nlocalepost) | **POST** /@apostrophecms/i18n/locale | Get locale path and manage clipboard
*InternationalizationApi* | [**i18nLocalesGet**](docs/InternationalizationApi.md#i18nlocalesget) | **GET** /@apostrophecms/i18n/locales | Get all configured locales
*MediaApi* | [**fileArchive**](docs/MediaApi.md#filearchive) | **POST** /@apostrophecms/file/archive | Archive files
*MediaApi* | [**fileDeleteById**](docs/MediaApi.md#filedeletebyid) | **DELETE** /@apostrophecms/file/{_id} | Delete file
*MediaApi* | [**fileDismissSubmissionById**](docs/MediaApi.md#filedismisssubmissionbyid) | **POST** /@apostrophecms/file/{_id}/dismiss-submission | Dismiss file submission
*MediaApi* | [**fileGet**](docs/MediaApi.md#fileget) | **GET** /@apostrophecms/file | List files
*MediaApi* | [**fileGetById**](docs/MediaApi.md#filegetbyid) | **GET** /@apostrophecms/file/{_id} | Get file by ID
*MediaApi* | [**fileGetLocaleById**](docs/MediaApi.md#filegetlocalebyid) | **GET** /@apostrophecms/file/{_id}/locale/{toLocale} | Get file locale
*MediaApi* | [**fileGetLocalesById**](docs/MediaApi.md#filegetlocalesbyid) | **GET** /@apostrophecms/file/{_id}/locales | Get file locales
*MediaApi* | [**fileLocalize**](docs/MediaApi.md#filelocalize) | **POST** /@apostrophecms/file/localize | Localize files
*MediaApi* | [**fileLocalizeById**](docs/MediaApi.md#filelocalizebyid) | **POST** /@apostrophecms/file/{_id}/localize | Localize file
*MediaApi* | [**filePatchById**](docs/MediaApi.md#filepatchbyid) | **PATCH** /@apostrophecms/file/{_id} | Update file
*MediaApi* | [**filePost**](docs/MediaApi.md#filepost) | **POST** /@apostrophecms/file | Create file
*MediaApi* | [**filePublish**](docs/MediaApi.md#filepublish) | **POST** /@apostrophecms/file/publish | Publish files
*MediaApi* | [**filePublishById**](docs/MediaApi.md#filepublishbyid) | **POST** /@apostrophecms/file/{_id}/publish | Publish file
*MediaApi* | [**filePutById**](docs/MediaApi.md#fileputbyid) | **PUT** /@apostrophecms/file/{_id} | Replace file
*MediaApi* | [**fileRestore**](docs/MediaApi.md#filerestore) | **POST** /@apostrophecms/file/restore | Restore files
*MediaApi* | [**fileRevertDraftToPublishedById**](docs/MediaApi.md#filerevertdrafttopublishedbyid) | **POST** /@apostrophecms/file/{_id}/revert-draft-to-published | Revert file draft to published
*MediaApi* | [**fileRevertPublishedToPreviousById**](docs/MediaApi.md#filerevertpublishedtopreviousbyid) | **POST** /@apostrophecms/file/{_id}/revert-published-to-previous | Revert file published to previous
*MediaApi* | [**fileShareById**](docs/MediaApi.md#filesharebyid) | **POST** /@apostrophecms/file/{_id}/share | Share file
*MediaApi* | [**fileSubmitById**](docs/MediaApi.md#filesubmitbyid) | **POST** /@apostrophecms/file/{_id}/submit | Submit file
*MediaApi* | [**fileTagArchive**](docs/MediaApi.md#filetagarchive) | **POST** /@apostrophecms/file-tag/archive | Archive file tags
*MediaApi* | [**fileTagDeleteById**](docs/MediaApi.md#filetagdeletebyid) | **DELETE** /@apostrophecms/file-tag/{_id} | Delete file tag
*MediaApi* | [**fileTagDismissSubmissionById**](docs/MediaApi.md#filetagdismisssubmissionbyid) | **POST** /@apostrophecms/file-tag/{_id}/dismiss-submission | Dismiss file tag submission
*MediaApi* | [**fileTagGet**](docs/MediaApi.md#filetagget) | **GET** /@apostrophecms/file-tag | List file tags
*MediaApi* | [**fileTagGetById**](docs/MediaApi.md#filetaggetbyid) | **GET** /@apostrophecms/file-tag/{_id} | Get file tag
*MediaApi* | [**fileTagGetLocaleById**](docs/MediaApi.md#filetaggetlocalebyid) | **GET** /@apostrophecms/file-tag/{_id}/locale/{toLocale} | Get file tag locale
*MediaApi* | [**fileTagGetLocalesById**](docs/MediaApi.md#filetaggetlocalesbyid) | **GET** /@apostrophecms/file-tag/{_id}/locales | Get file tag locales
*MediaApi* | [**fileTagLocalize**](docs/MediaApi.md#filetaglocalize) | **POST** /@apostrophecms/file-tag/localize | Localize file tags
*MediaApi* | [**fileTagLocalizeById**](docs/MediaApi.md#filetaglocalizebyid) | **POST** /@apostrophecms/file-tag/{_id}/localize | Localize file tag
*MediaApi* | [**fileTagPatchById**](docs/MediaApi.md#filetagpatchbyid) | **PATCH** /@apostrophecms/file-tag/{_id} | Update file tag
*MediaApi* | [**fileTagPost**](docs/MediaApi.md#filetagpost) | **POST** /@apostrophecms/file-tag | Create file tag
*MediaApi* | [**fileTagPublish**](docs/MediaApi.md#filetagpublish) | **POST** /@apostrophecms/file-tag/publish | Publish file tags
*MediaApi* | [**fileTagPublishById**](docs/MediaApi.md#filetagpublishbyid) | **POST** /@apostrophecms/file-tag/{_id}/publish | Publish file tag
*MediaApi* | [**fileTagPutById**](docs/MediaApi.md#filetagputbyid) | **PUT** /@apostrophecms/file-tag/{_id} | Replace file tag
*MediaApi* | [**fileTagRestore**](docs/MediaApi.md#filetagrestore) | **POST** /@apostrophecms/file-tag/restore | Restore file tags
*MediaApi* | [**fileTagRevertDraftToPublishedById**](docs/MediaApi.md#filetagrevertdrafttopublishedbyid) | **POST** /@apostrophecms/file-tag/{_id}/revert-draft-to-published | Revert file tag draft to published
*MediaApi* | [**fileTagRevertPublishedToPreviousById**](docs/MediaApi.md#filetagrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/file-tag/{_id}/revert-published-to-previous | Revert file tag published to previous
*MediaApi* | [**fileTagShareById**](docs/MediaApi.md#filetagsharebyid) | **POST** /@apostrophecms/file-tag/{_id}/share | Share file tag
*MediaApi* | [**fileTagSubmitById**](docs/MediaApi.md#filetagsubmitbyid) | **POST** /@apostrophecms/file-tag/{_id}/submit | Submit file tag
*MediaApi* | [**fileTagUnpublishById**](docs/MediaApi.md#filetagunpublishbyid) | **POST** /@apostrophecms/file-tag/{_id}/unpublish | Unpublish file tag
*MediaApi* | [**fileUnpublishById**](docs/MediaApi.md#fileunpublishbyid) | **POST** /@apostrophecms/file/{_id}/unpublish | Unpublish file
*MediaApi* | [**imageArchive**](docs/MediaApi.md#imagearchive) | **POST** /@apostrophecms/image/archive | Archive images
*MediaApi* | [**imageAutocrop**](docs/MediaApi.md#imageautocrop) | **POST** /@apostrophecms/image/autocrop | Auto-crop images
*MediaApi* | [**imageDeleteById**](docs/MediaApi.md#imagedeletebyid) | **DELETE** /@apostrophecms/image/{_id} | Delete image document
*MediaApi* | [**imageDismissSubmissionById**](docs/MediaApi.md#imagedismisssubmissionbyid) | **POST** /@apostrophecms/image/{_id}/dismiss-submission | Dismiss image submission
*MediaApi* | [**imageGet**](docs/MediaApi.md#imageget) | **GET** /@apostrophecms/image | Get images
*MediaApi* | [**imageGetById**](docs/MediaApi.md#imagegetbyid) | **GET** /@apostrophecms/image/{_id} | Get image document
*MediaApi* | [**imageGetLocaleById**](docs/MediaApi.md#imagegetlocalebyid) | **GET** /@apostrophecms/image/{_id}/locale/{toLocale} | Get image document locale
*MediaApi* | [**imageGetLocalesById**](docs/MediaApi.md#imagegetlocalesbyid) | **GET** /@apostrophecms/image/{_id}/locales | Get image document locales
*MediaApi* | [**imageGetSrcById**](docs/MediaApi.md#imagegetsrcbyid) | **GET** /@apostrophecms/image/{_id}/src | Get image source URL
*MediaApi* | [**imageLocalize**](docs/MediaApi.md#imagelocalize) | **POST** /@apostrophecms/image/localize | Localize images
*MediaApi* | [**imageLocalizeById**](docs/MediaApi.md#imagelocalizebyid) | **POST** /@apostrophecms/image/{_id}/localize | Localize image document
*MediaApi* | [**imagePatchById**](docs/MediaApi.md#imagepatchbyid) | **PATCH** /@apostrophecms/image/{_id} | Update image document
*MediaApi* | [**imagePost**](docs/MediaApi.md#imagepost) | **POST** /@apostrophecms/image | Create image
*MediaApi* | [**imagePublish**](docs/MediaApi.md#imagepublish) | **POST** /@apostrophecms/image/publish | Publish images
*MediaApi* | [**imagePublishById**](docs/MediaApi.md#imagepublishbyid) | **POST** /@apostrophecms/image/{_id}/publish | Publish image document
*MediaApi* | [**imagePutById**](docs/MediaApi.md#imageputbyid) | **PUT** /@apostrophecms/image/{_id} | Replace image document
*MediaApi* | [**imageRestore**](docs/MediaApi.md#imagerestore) | **POST** /@apostrophecms/image/restore | Restore images
*MediaApi* | [**imageRevertDraftToPublishedById**](docs/MediaApi.md#imagerevertdrafttopublishedbyid) | **POST** /@apostrophecms/image/{_id}/revert-draft-to-published | Revert image draft to published
*MediaApi* | [**imageRevertPublishedToPreviousById**](docs/MediaApi.md#imagerevertpublishedtopreviousbyid) | **POST** /@apostrophecms/image/{_id}/revert-published-to-previous | Revert image published to previous
*MediaApi* | [**imageShareById**](docs/MediaApi.md#imagesharebyid) | **POST** /@apostrophecms/image/{_id}/share | Share image document
*MediaApi* | [**imageSubmitById**](docs/MediaApi.md#imagesubmitbyid) | **POST** /@apostrophecms/image/{_id}/submit | Submit image document
*MediaApi* | [**imageTag**](docs/MediaApi.md#imagetag) | **POST** /@apostrophecms/image/tag | Tag images
*MediaApi* | [**imageTagArchive**](docs/MediaApi.md#imagetagarchive) | **POST** /@apostrophecms/image-tag/archive | Archive image tags
*MediaApi* | [**imageTagDeleteById**](docs/MediaApi.md#imagetagdeletebyid) | **DELETE** /@apostrophecms/image-tag/{_id} | Delete image tag
*MediaApi* | [**imageTagDismissSubmissionById**](docs/MediaApi.md#imagetagdismisssubmissionbyid) | **POST** /@apostrophecms/image-tag/{_id}/dismiss-submission | Dismiss image tag submission
*MediaApi* | [**imageTagGet**](docs/MediaApi.md#imagetagget) | **GET** /@apostrophecms/image-tag | Get image tags
*MediaApi* | [**imageTagGetById**](docs/MediaApi.md#imagetaggetbyid) | **GET** /@apostrophecms/image-tag/{_id} | Get image tag
*MediaApi* | [**imageTagGetLocaleById**](docs/MediaApi.md#imagetaggetlocalebyid) | **GET** /@apostrophecms/image-tag/{_id}/locale/{toLocale} | Get image tag locale
*MediaApi* | [**imageTagGetLocalesById**](docs/MediaApi.md#imagetaggetlocalesbyid) | **GET** /@apostrophecms/image-tag/{_id}/locales | Get image tag locales
*MediaApi* | [**imageTagLocalize**](docs/MediaApi.md#imagetaglocalize) | **POST** /@apostrophecms/image-tag/localize | Localize image tags
*MediaApi* | [**imageTagLocalizeById**](docs/MediaApi.md#imagetaglocalizebyid) | **POST** /@apostrophecms/image-tag/{_id}/localize | Localize image tag
*MediaApi* | [**imageTagPatchById**](docs/MediaApi.md#imagetagpatchbyid) | **PATCH** /@apostrophecms/image-tag/{_id} | Update image tag
*MediaApi* | [**imageTagPost**](docs/MediaApi.md#imagetagpost) | **POST** /@apostrophecms/image-tag | Create image tag
*MediaApi* | [**imageTagPublish**](docs/MediaApi.md#imagetagpublish) | **POST** /@apostrophecms/image-tag/publish | Publish image tags
*MediaApi* | [**imageTagPublishById**](docs/MediaApi.md#imagetagpublishbyid) | **POST** /@apostrophecms/image-tag/{_id}/publish | Publish image tag
*MediaApi* | [**imageTagPutById**](docs/MediaApi.md#imagetagputbyid) | **PUT** /@apostrophecms/image-tag/{_id} | Replace image tag
*MediaApi* | [**imageTagRestore**](docs/MediaApi.md#imagetagrestore) | **POST** /@apostrophecms/image-tag/restore | Restore image tags
*MediaApi* | [**imageTagRevertDraftToPublishedById**](docs/MediaApi.md#imagetagrevertdrafttopublishedbyid) | **POST** /@apostrophecms/image-tag/{_id}/revert-draft-to-published | Revert draft to published
*MediaApi* | [**imageTagRevertPublishedToPreviousById**](docs/MediaApi.md#imagetagrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/image-tag/{_id}/revert-published-to-previous | Revert published to previous
*MediaApi* | [**imageTagShareById**](docs/MediaApi.md#imagetagsharebyid) | **POST** /@apostrophecms/image-tag/{_id}/share | Share image tag
*MediaApi* | [**imageTagSubmitById**](docs/MediaApi.md#imagetagsubmitbyid) | **POST** /@apostrophecms/image-tag/{_id}/submit | Submit image tag
*MediaApi* | [**imageTagUnpublishById**](docs/MediaApi.md#imagetagunpublishbyid) | **POST** /@apostrophecms/image-tag/{_id}/unpublish | Unpublish image tag
*MediaApi* | [**imageUnpublishById**](docs/MediaApi.md#imageunpublishbyid) | **POST** /@apostrophecms/image/{_id}/unpublish | Unpublish image document
*PagesApi* | [**pageArchive**](docs/PagesApi.md#pagearchive) | **POST** /@apostrophecms/page/archive | Archive pages
*PagesApi* | [**pageDeleteById**](docs/PagesApi.md#pagedeletebyid) | **DELETE** /@apostrophecms/page/{_id} | Delete page
*PagesApi* | [**pageDismissSubmissionById**](docs/PagesApi.md#pagedismisssubmissionbyid) | **POST** /@apostrophecms/page/{_id}/dismiss-submission | Dismiss page submission
*PagesApi* | [**pageGet**](docs/PagesApi.md#pageget) | **GET** /@apostrophecms/page | Get page tree
*PagesApi* | [**pageGetById**](docs/PagesApi.md#pagegetbyid) | **GET** /@apostrophecms/page/{_id} | Get page by ID
*PagesApi* | [**pageGetLocaleById**](docs/PagesApi.md#pagegetlocalebyid) | **GET** /@apostrophecms/page/{_id}/locale/{toLocale} | Get page in specific locale
*PagesApi* | [**pageGetLocalesById**](docs/PagesApi.md#pagegetlocalesbyid) | **GET** /@apostrophecms/page/{_id}/locales | Get page locales
*PagesApi* | [**pageLocalize**](docs/PagesApi.md#pagelocalize) | **POST** /@apostrophecms/page/localize | Localize pages
*PagesApi* | [**pageLocalizeById**](docs/PagesApi.md#pagelocalizebyid) | **POST** /@apostrophecms/page/{_id}/localize | Localize page
*PagesApi* | [**pagePatchById**](docs/PagesApi.md#pagepatchbyid) | **PATCH** /@apostrophecms/page/{_id} | Update page
*PagesApi* | [**pagePost**](docs/PagesApi.md#pagepost) | **POST** /@apostrophecms/page | Create new page
*PagesApi* | [**pagePublish**](docs/PagesApi.md#pagepublish) | **POST** /@apostrophecms/page/publish | Publish pages
*PagesApi* | [**pagePublishById**](docs/PagesApi.md#pagepublishbyid) | **POST** /@apostrophecms/page/{_id}/publish | Publish page
*PagesApi* | [**pagePutById**](docs/PagesApi.md#pageputbyid) | **PUT** /@apostrophecms/page/{_id} | Replace page
*PagesApi* | [**pageRestore**](docs/PagesApi.md#pagerestore) | **POST** /@apostrophecms/page/restore | Restore pages
*PagesApi* | [**pageRevertDraftToPublishedById**](docs/PagesApi.md#pagerevertdrafttopublishedbyid) | **POST** /@apostrophecms/page/{_id}/revert-draft-to-published | Revert draft to published
*PagesApi* | [**pageRevertPublishedToPreviousById**](docs/PagesApi.md#pagerevertpublishedtopreviousbyid) | **POST** /@apostrophecms/page/{_id}/revert-published-to-previous | Revert published to previous
*PagesApi* | [**pageShareById**](docs/PagesApi.md#pagesharebyid) | **POST** /@apostrophecms/page/{_id}/share | Share page
*PagesApi* | [**pageSubmitById**](docs/PagesApi.md#pagesubmitbyid) | **POST** /@apostrophecms/page/{_id}/submit | Submit page
*PagesApi* | [**pageUnpublishById**](docs/PagesApi.md#pageunpublishbyid) | **POST** /@apostrophecms/page/{_id}/unpublish | Unpublish page
*SubmittedDraftsApi* | [**submittedDraftArchive**](docs/SubmittedDraftsApi.md#submitteddraftarchive) | **POST** /@apostrophecms/submitted-draft/archive | Archive submitted drafts
*SubmittedDraftsApi* | [**submittedDraftDeleteById**](docs/SubmittedDraftsApi.md#submitteddraftdeletebyid) | **DELETE** /@apostrophecms/submitted-draft/{_id} | Delete submitted draft
*SubmittedDraftsApi* | [**submittedDraftDismissSubmissionById**](docs/SubmittedDraftsApi.md#submitteddraftdismisssubmissionbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/dismiss-submission | Dismiss submission
*SubmittedDraftsApi* | [**submittedDraftGet**](docs/SubmittedDraftsApi.md#submitteddraftget) | **GET** /@apostrophecms/submitted-draft | List submitted drafts
*SubmittedDraftsApi* | [**submittedDraftGetById**](docs/SubmittedDraftsApi.md#submitteddraftgetbyid) | **GET** /@apostrophecms/submitted-draft/{_id} | Get submitted draft
*SubmittedDraftsApi* | [**submittedDraftGetLocaleById**](docs/SubmittedDraftsApi.md#submitteddraftgetlocalebyid) | **GET** /@apostrophecms/submitted-draft/{_id}/locale/{toLocale} | Get submitted draft locale
*SubmittedDraftsApi* | [**submittedDraftGetLocalesById**](docs/SubmittedDraftsApi.md#submitteddraftgetlocalesbyid) | **GET** /@apostrophecms/submitted-draft/{_id}/locales | Get submitted draft locales
*SubmittedDraftsApi* | [**submittedDraftLocalize**](docs/SubmittedDraftsApi.md#submitteddraftlocalize) | **POST** /@apostrophecms/submitted-draft/localize | Localize submitted drafts
*SubmittedDraftsApi* | [**submittedDraftLocalizeById**](docs/SubmittedDraftsApi.md#submitteddraftlocalizebyid) | **POST** /@apostrophecms/submitted-draft/{_id}/localize | Localize submitted draft
*SubmittedDraftsApi* | [**submittedDraftPatchById**](docs/SubmittedDraftsApi.md#submitteddraftpatchbyid) | **PATCH** /@apostrophecms/submitted-draft/{_id} | Update submitted draft
*SubmittedDraftsApi* | [**submittedDraftPost**](docs/SubmittedDraftsApi.md#submitteddraftpost) | **POST** /@apostrophecms/submitted-draft | Create submitted draft
*SubmittedDraftsApi* | [**submittedDraftPublish**](docs/SubmittedDraftsApi.md#submitteddraftpublish) | **POST** /@apostrophecms/submitted-draft/publish | Publish submitted drafts
*SubmittedDraftsApi* | [**submittedDraftPublishById**](docs/SubmittedDraftsApi.md#submitteddraftpublishbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/publish | Publish submitted draft
*SubmittedDraftsApi* | [**submittedDraftPutById**](docs/SubmittedDraftsApi.md#submitteddraftputbyid) | **PUT** /@apostrophecms/submitted-draft/{_id} | Replace submitted draft
*SubmittedDraftsApi* | [**submittedDraftRestore**](docs/SubmittedDraftsApi.md#submitteddraftrestore) | **POST** /@apostrophecms/submitted-draft/restore | Restore submitted drafts
*SubmittedDraftsApi* | [**submittedDraftRevertDraftToPublishedById**](docs/SubmittedDraftsApi.md#submitteddraftrevertdrafttopublishedbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/revert-draft-to-published | Revert draft to published
*SubmittedDraftsApi* | [**submittedDraftRevertPublishedToPreviousById**](docs/SubmittedDraftsApi.md#submitteddraftrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/revert-published-to-previous | Revert published to previous
*SubmittedDraftsApi* | [**submittedDraftShareById**](docs/SubmittedDraftsApi.md#submitteddraftsharebyid) | **POST** /@apostrophecms/submitted-draft/{_id}/share | Share submitted draft
*SubmittedDraftsApi* | [**submittedDraftSubmitById**](docs/SubmittedDraftsApi.md#submitteddraftsubmitbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/submit | Submit draft
*SubmittedDraftsApi* | [**submittedDraftUnpublishById**](docs/SubmittedDraftsApi.md#submitteddraftunpublishbyid) | **POST** /@apostrophecms/submitted-draft/{_id}/unpublish | Unpublish submitted draft
*UsersApi* | [**userArchive**](docs/UsersApi.md#userarchive) | **POST** /@apostrophecms/user/archive | Archive users
*UsersApi* | [**userCreate**](docs/UsersApi.md#usercreate) | **POST** /@apostrophecms/user | Create user
*UsersApi* | [**userDeleteById**](docs/UsersApi.md#userdeletebyid) | **DELETE** /@apostrophecms/user/{_id} | Delete user
*UsersApi* | [**userDismissSubmissionById**](docs/UsersApi.md#userdismisssubmissionbyid) | **POST** /@apostrophecms/user/{_id}/dismiss-submission | Dismiss user submission
*UsersApi* | [**userGetById**](docs/UsersApi.md#usergetbyid) | **GET** /@apostrophecms/user/{_id} | Get user
*UsersApi* | [**userGetLocaleById**](docs/UsersApi.md#usergetlocalebyid) | **GET** /@apostrophecms/user/{_id}/locale/{toLocale} | Get user locale
*UsersApi* | [**userGetLocalesById**](docs/UsersApi.md#usergetlocalesbyid) | **GET** /@apostrophecms/user/{_id}/locales | Get user locales
*UsersApi* | [**userList**](docs/UsersApi.md#userlist) | **GET** /@apostrophecms/user | List users
*UsersApi* | [**userLocalize**](docs/UsersApi.md#userlocalize) | **POST** /@apostrophecms/user/localize | Localize users
*UsersApi* | [**userLocalizeById**](docs/UsersApi.md#userlocalizebyid) | **POST** /@apostrophecms/user/{_id}/localize | Localize user
*UsersApi* | [**userPatchById**](docs/UsersApi.md#userpatchbyid) | **PATCH** /@apostrophecms/user/{_id} | Update user
*UsersApi* | [**userPublish**](docs/UsersApi.md#userpublish) | **POST** /@apostrophecms/user/publish | Publish users
*UsersApi* | [**userPublishById**](docs/UsersApi.md#userpublishbyid) | **POST** /@apostrophecms/user/{_id}/publish | Publish user
*UsersApi* | [**userPutById**](docs/UsersApi.md#userputbyid) | **PUT** /@apostrophecms/user/{_id} | Replace user
*UsersApi* | [**userRestore**](docs/UsersApi.md#userrestore) | **POST** /@apostrophecms/user/restore | Restore users
*UsersApi* | [**userRevertDraftToPublishedById**](docs/UsersApi.md#userrevertdrafttopublishedbyid) | **POST** /@apostrophecms/user/{_id}/revert-draft-to-published | Revert draft to published
*UsersApi* | [**userRevertPublishedToPreviousById**](docs/UsersApi.md#userrevertpublishedtopreviousbyid) | **POST** /@apostrophecms/user/{_id}/revert-published-to-previous | Revert published to previous
*UsersApi* | [**userShareById**](docs/UsersApi.md#usersharebyid) | **POST** /@apostrophecms/user/{_id}/share | Share user
*UsersApi* | [**userSubmitById**](docs/UsersApi.md#usersubmitbyid) | **POST** /@apostrophecms/user/{_id}/submit | Submit user
*UsersApi* | [**userUnpublishById**](docs/UsersApi.md#userunpublishbyid) | **POST** /@apostrophecms/user/{_id}/unpublish | Unpublish user


### Documentation For Models

 - [ApiError](docs/ApiError.md)
 - [AreaField](docs/AreaField.md)
 - [AreaOptions](docs/AreaOptions.md)
 - [AreaWidgetGroup](docs/AreaWidgetGroup.md)
 - [ArrayField](docs/ArrayField.md)
 - [Attachment](docs/Attachment.md)
 - [AttachmentCropRequest](docs/AttachmentCropRequest.md)
 - [AttachmentCropRequestCrop](docs/AttachmentCropRequestCrop.md)
 - [AttachmentField](docs/AttachmentField.md)
 - [AttachmentFieldAllOfAccept](docs/AttachmentFieldAllOfAccept.md)
 - [AuthContext200Response](docs/AuthContext200Response.md)
 - [AuthContextPost200Response](docs/AuthContextPost200Response.md)
 - [AuthLogin200Response](docs/AuthLogin200Response.md)
 - [AuthLoginRequest](docs/AuthLoginRequest.md)
 - [AuthLogout200Response](docs/AuthLogout200Response.md)
 - [AuthReset200Response](docs/AuthReset200Response.md)
 - [AuthReset410Response](docs/AuthReset410Response.md)
 - [AuthResetRequest](docs/AuthResetRequest.md)
 - [AuthResetRequest200Response](docs/AuthResetRequest200Response.md)
 - [AuthResetRequestRequest](docs/AuthResetRequestRequest.md)
 - [AuthWhoAmI200Response](docs/AuthWhoAmI200Response.md)
 - [BaseField](docs/BaseField.md)
 - [BooleanField](docs/BooleanField.md)
 - [BooleanFieldAllOfToggle](docs/BooleanFieldAllOfToggle.md)
 - [BooleanFieldAllOfToggleOneOf](docs/BooleanFieldAllOfToggleOneOf.md)
 - [BulkOperationRequest](docs/BulkOperationRequest.md)
 - [BulkOperationResponse](docs/BulkOperationResponse.md)
 - [CheckboxesField](docs/CheckboxesField.md)
 - [CheckboxesFieldAllOfChoices](docs/CheckboxesFieldAllOfChoices.md)
 - [CheckboxesFieldAllOfDef](docs/CheckboxesFieldAllOfDef.md)
 - [CheckboxesFieldAllOfFollowing](docs/CheckboxesFieldAllOfFollowing.md)
 - [CheckboxesFieldAllOfFollowingIgnore](docs/CheckboxesFieldAllOfFollowingIgnore.md)
 - [ColorField](docs/ColorField.md)
 - [CreatePieceRequest](docs/CreatePieceRequest.md)
 - [DateAndTimeField](docs/DateAndTimeField.md)
 - [DateBoundaryOptions](docs/DateBoundaryOptions.md)
 - [DateField](docs/DateField.md)
 - [DateTimeBoundaryOptions](docs/DateTimeBoundaryOptions.md)
 - [DifferentHostnameResponse](docs/DifferentHostnameResponse.md)
 - [EmailField](docs/EmailField.md)
 - [ExistInLocaleRequest](docs/ExistInLocaleRequest.md)
 - [ExistInLocaleResponse](docs/ExistInLocaleResponse.md)
 - [FieldDefinition](docs/FieldDefinition.md)
 - [FieldPredicate](docs/FieldPredicate.md)
 - [Fieldset](docs/Fieldset.md)
 - [FileGet200Response](docs/FileGet200Response.md)
 - [FileObject](docs/FileObject.md)
 - [FileObjectAttachment](docs/FileObjectAttachment.md)
 - [FilePatchByIdRequest](docs/FilePatchByIdRequest.md)
 - [FilePostRequest](docs/FilePostRequest.md)
 - [FileTag](docs/FileTag.md)
 - [FileTagGet200Response](docs/FileTagGet200Response.md)
 - [FileTagLocalizeRequest](docs/FileTagLocalizeRequest.md)
 - [FileTagPatchByIdRequest](docs/FileTagPatchByIdRequest.md)
 - [FileTagPostRequest](docs/FileTagPostRequest.md)
 - [FileTagPublishRequest](docs/FileTagPublishRequest.md)
 - [FileTagPutByIdRequest](docs/FileTagPutByIdRequest.md)
 - [FlatPageResponse](docs/FlatPageResponse.md)
 - [FlatPageResponseResultsInner](docs/FlatPageResponseResultsInner.md)
 - [FloatField](docs/FloatField.md)
 - [Global](docs/Global.md)
 - [GlobalGet200Response](docs/GlobalGet200Response.md)
 - [GlobalPatch](docs/GlobalPatch.md)
 - [GlobalPostRequest](docs/GlobalPostRequest.md)
 - [GlobalPostRequestContactInfo](docs/GlobalPostRequestContactInfo.md)
 - [GlobalPostRequestSiteSettings](docs/GlobalPostRequestSiteSettings.md)
 - [GlobalPostRequestSocialMedia](docs/GlobalPostRequestSocialMedia.md)
 - [I18nLocalePost200Response](docs/I18nLocalePost200Response.md)
 - [Image](docs/Image.md)
 - [ImageAttachment](docs/ImageAttachment.md)
 - [ImageAutocropRequest](docs/ImageAutocropRequest.md)
 - [ImageGet200Response](docs/ImageGet200Response.md)
 - [ImageGetSrcById200Response](docs/ImageGetSrcById200Response.md)
 - [ImageLocalizeRequest](docs/ImageLocalizeRequest.md)
 - [ImagePatchByIdRequest](docs/ImagePatchByIdRequest.md)
 - [ImagePostRequest](docs/ImagePostRequest.md)
 - [ImagePublishRequest](docs/ImagePublishRequest.md)
 - [ImageTag](docs/ImageTag.md)
 - [ImageTagGet200Response](docs/ImageTagGet200Response.md)
 - [ImageTagPatchByIdRequest](docs/ImageTagPatchByIdRequest.md)
 - [ImageTagPostRequest](docs/ImageTagPostRequest.md)
 - [ImageTagRequest](docs/ImageTagRequest.md)
 - [InlineObject](docs/InlineObject.md)
 - [InlineObject1](docs/InlineObject1.md)
 - [InlineObject2](docs/InlineObject2.md)
 - [InlineObject3](docs/InlineObject3.md)
 - [InlineObject4](docs/InlineObject4.md)
 - [InlineObject5](docs/InlineObject5.md)
 - [IntegerField](docs/IntegerField.md)
 - [LocaleRequest](docs/LocaleRequest.md)
 - [LocalesResponseValue](docs/LocalesResponseValue.md)
 - [NumericRangeOptions](docs/NumericRangeOptions.md)
 - [ObjectField](docs/ObjectField.md)
 - [OembedField](docs/OembedField.md)
 - [OperatorObject](docs/OperatorObject.md)
 - [Page](docs/Page.md)
 - [PageArchive200Response](docs/PageArchive200Response.md)
 - [PageArchiveRequest](docs/PageArchiveRequest.md)
 - [PageCreateRequest](docs/PageCreateRequest.md)
 - [PageCreateRequestPosition](docs/PageCreateRequestPosition.md)
 - [PageDeleteById400Response](docs/PageDeleteById400Response.md)
 - [PageDotNotationUpdateValue](docs/PageDotNotationUpdateValue.md)
 - [PageGet200Response](docs/PageGet200Response.md)
 - [PageGetLocalesById200Response](docs/PageGetLocalesById200Response.md)
 - [PageGetLocalesById200ResponseResultsInner](docs/PageGetLocalesById200ResponseResultsInner.md)
 - [PageLocaleResult](docs/PageLocaleResult.md)
 - [PageLocalesResponse](docs/PageLocalesResponse.md)
 - [PageLocalizeByIdRequest](docs/PageLocalizeByIdRequest.md)
 - [PageLocalizeRequest](docs/PageLocalizeRequest.md)
 - [PageMain](docs/PageMain.md)
 - [PageMainItemsInner](docs/PageMainItemsInner.md)
 - [PagePatchByIdRequest](docs/PagePatchByIdRequest.md)
 - [PagePublishRequest](docs/PagePublishRequest.md)
 - [PagePutByIdRequest](docs/PagePutByIdRequest.md)
 - [PageSeoFields](docs/PageSeoFields.md)
 - [PageSeoFieldsOgImage](docs/PageSeoFieldsOgImage.md)
 - [PageSeoFieldsOgImageAttachment](docs/PageSeoFieldsOgImageAttachment.md)
 - [PageSummary](docs/PageSummary.md)
 - [PageTreeResponse](docs/PageTreeResponse.md)
 - [PageUpdateRequest](docs/PageUpdateRequest.md)
 - [PageUpdateRequestPosition](docs/PageUpdateRequestPosition.md)
 - [PaginatedResponse](docs/PaginatedResponse.md)
 - [PaginatedResponseData](docs/PaginatedResponseData.md)
 - [PasswordField](docs/PasswordField.md)
 - [PieceResponse](docs/PieceResponse.md)
 - [RadioField](docs/RadioField.md)
 - [RadioFieldAllOfChoices](docs/RadioFieldAllOfChoices.md)
 - [RadioFieldAllOfDef](docs/RadioFieldAllOfDef.md)
 - [RadioFieldAllOfFollowing](docs/RadioFieldAllOfFollowing.md)
 - [RadioFieldAllOfFollowingIgnore](docs/RadioFieldAllOfFollowingIgnore.md)
 - [RangeField](docs/RangeField.md)
 - [RelationshipEntry](docs/RelationshipEntry.md)
 - [RelationshipField](docs/RelationshipField.md)
 - [RelationshipReverseField](docs/RelationshipReverseField.md)
 - [SameHostnameResponse](docs/SameHostnameResponse.md)
 - [SelectChoice](docs/SelectChoice.md)
 - [SelectChoiceValue](docs/SelectChoiceValue.md)
 - [SelectField](docs/SelectField.md)
 - [SelectFieldAllOfChoices](docs/SelectFieldAllOfChoices.md)
 - [SelectFieldAllOfDef](docs/SelectFieldAllOfDef.md)
 - [SelectFieldAllOfFollowing](docs/SelectFieldAllOfFollowing.md)
 - [SelectFieldAllOfFollowingIgnore](docs/SelectFieldAllOfFollowingIgnore.md)
 - [SlugField](docs/SlugField.md)
 - [StringField](docs/StringField.md)
 - [StringFieldAllOfFollowing](docs/StringFieldAllOfFollowing.md)
 - [StringFieldAllOfFollowingIgnore](docs/StringFieldAllOfFollowingIgnore.md)
 - [SubmittedDraft](docs/SubmittedDraft.md)
 - [SubmittedDraftArchive200Response](docs/SubmittedDraftArchive200Response.md)
 - [SubmittedDraftGet200Response](docs/SubmittedDraftGet200Response.md)
 - [SubmittedDraftLocalize200Response](docs/SubmittedDraftLocalize200Response.md)
 - [SubmittedDraftPatchByIdRequest](docs/SubmittedDraftPatchByIdRequest.md)
 - [SubmittedDraftPostRequest](docs/SubmittedDraftPostRequest.md)
 - [SubmittedDraftPublish200Response](docs/SubmittedDraftPublish200Response.md)
 - [SubmittedDraftPutByIdRequest](docs/SubmittedDraftPutByIdRequest.md)
 - [SubmittedDraftRestore200Response](docs/SubmittedDraftRestore200Response.md)
 - [TimeField](docs/TimeField.md)
 - [UiCondition](docs/UiCondition.md)
 - [UrlField](docs/UrlField.md)
 - [User](docs/User.md)
 - [UserCreateRequest](docs/UserCreateRequest.md)
 - [UserList200Response](docs/UserList200Response.md)
 - [UserPatchByIdRequest](docs/UserPatchByIdRequest.md)
 - [UserPutByIdRequest](docs/UserPutByIdRequest.md)
 - [Widget](docs/Widget.md)
 - [WidgetImport](docs/WidgetImport.md)


<a id="documentation-for-authorization"></a>
## Documentation For Authorization


Authentication schemes defined for the API:
<a id="ApiKeyAuth"></a>
### ApiKeyAuth

- **Type**: API key
- **API key parameter name**: apikey
- **Location**: URL query string

<a id="BearerAuth"></a>
### BearerAuth

- **Type**: Bearer authentication

<a id="SessionAuth"></a>
### SessionAuth

- **Type**: API key
- **API key parameter name**: project-shortname.sid
- **Location**: 


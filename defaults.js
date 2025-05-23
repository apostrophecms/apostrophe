module.exports = {
  modules: {
    '@apostrophecms/log': {},
    '@apostrophecms/error': {},
    '@apostrophecms/util': {},
    '@apostrophecms/i18n': {},
    '@apostrophecms/multisite-i18n': {},
    '@apostrophecms/task': {},
    '@apostrophecms/schema': {},
    '@apostrophecms/uploadfs': {},
    '@apostrophecms/asset': {},
    '@apostrophecms/busy': {},
    '@apostrophecms/launder': {},
    '@apostrophecms/http': {},
    '@apostrophecms/db': {},
    '@apostrophecms/lock': {},
    '@apostrophecms/cache': {},
    '@apostrophecms/migration': {},
    '@apostrophecms/attachment': {},
    '@apostrophecms/express': {},
    '@apostrophecms/url': {},
    '@apostrophecms/template': {},
    '@apostrophecms/email': {},
    '@apostrophecms/permission': {},
    '@apostrophecms/admin-bar': {},
    '@apostrophecms/notification': {},
    '@apostrophecms/login': {},
    '@apostrophecms/doc': {},
    '@apostrophecms/job': {},
    '@apostrophecms/modal': {},
    '@apostrophecms/oembed': {},
    '@apostrophecms/pager': {},
    '@apostrophecms/any-doc-type': {},
    // global comes first so it can register a doc type manager and clean
    // things up before pages claims any orphan page types
    '@apostrophecms/global': {},
    '@apostrophecms/polymorphic-type': {},
    '@apostrophecms/page': {},
    '@apostrophecms/home-page': {},
    '@apostrophecms/archive-page': {},
    '@apostrophecms/search': {},
    '@apostrophecms/any-page-type': {},
    '@apostrophecms/area': {},
    '@apostrophecms/rich-text-widget': {},
    '@apostrophecms/html-widget': {},
    '@apostrophecms/color-field': {},
    '@apostrophecms/oembed-field': {},
    '@apostrophecms/video-widget': {},
    '@apostrophecms/ui': {},
    '@apostrophecms/user': {},
    '@apostrophecms/settings': {},
    '@apostrophecms/image': {},
    '@apostrophecms/image-tag': {},
    '@apostrophecms/image-widget': {},
    '@apostrophecms/file': {},
    '@apostrophecms/file-tag': {},
    '@apostrophecms/soft-redirect': {},
    '@apostrophecms/submitted-draft': {},
    '@apostrophecms/command-menu': {},
    '@apostrophecms/translation': {}
  }
};

apos.define('apostrophe-images-editor-modal', {
  extend: 'apostrophe-pieces-editor-modal',
  transition: 'slide',
  construct: function(self, options) {
    var superBeforeShow = self.beforeShow;
    self.beforeShow = function(callback) {
      self.enableTitleFromAttachment();
      return superBeforeShow(callback);
    };
    // If the attachment is updated and the title field has not yet been set,
    // set it based on the filename
    self.enableTitleFromAttachment = function() {
      apos.on('attachmentUpdated', self.titleFromAttachmentListener);
    };
    // This event listener implements updating the title from the attachment's name
    self.titleFromAttachmentListener = function(info) {
      if (!self.$el.is(':visible')) {
        // Don't hang around forever if this modal is done
        apos.off('attachmentUpdated', self.titleFromAttachmentListener);
        return;
      }
      if (!info.$fieldset.closest(self.$el).length) {
        // Not one of ours
        return;
      }
      var $title = apos.schemas.findField(self.$el, 'title');
      if (!$title.val().length) {
        $title.val(info.attachment.name.replace(/-/g, ' '));
        // So the slug suggester fires too
        $title.trigger('change');
      }
    };
  }
});

function jotFileUploadHandler(options) {
  $(function() {
    $('#file').change(function() {
      var form = $(this).closest('form');
      var progress = form.find('.spinner').show();
      form.submit();
    });
    if (options.uploaded) {
      window.parent.$('.jot-widget-editor').trigger('uploaded', options.id);
    }
  });
}

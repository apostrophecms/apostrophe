function aposFileUploadHandler(options) {
  $(function() {
    $('#file').change(function() {
      var form = $(this).closest('form');
      var progress = form.find('[data-spinner]').show();
      form.submit();
    });
    if (options.uploaded) {
      window.parent.$('.apos-widget-editor').trigger('uploaded', options.id);
    }
  });
}

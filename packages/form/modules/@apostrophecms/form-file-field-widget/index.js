module.exports = {
  extend: '@apostrophecms/form-base-field-widget',
  options: {
    label: 'aposForm:file',
    icon: 'file-upload-outline-icon'
  },
  icons: {
    'file-upload-outline-icon': 'FileUploadOutline'
  },
  fields: {
    add: {
      allowMultiple: {
        label: 'aposForm:fileAllowMultiple',
        type: 'boolean',
        def: true
      },
      limitSize: {
        label: 'aposForm:fileLimitSize',
        type: 'boolean',
        def: false
      },
      maxSize: {
        label: 'aposForm:fileMaxSize',
        help: 'aposForm:fileMaxSizeHelp',
        type: 'integer',
        if: {
          limitSize: true
        }
      }
    }
  },
  methods (self) {
    return {
      async sanitizeFormField (widget, input, output) {
        const fileIds = self.apos.launder.ids(input[widget.fieldName]);

        // File IDs are stored in an array to allow multiple-file uploads.
        output[widget.fieldName] = [];

        for (const id of fileIds) {
          const info = await self.apos.attachment.db.findOne({
            _id: id
          });

          if (info) {
            output[widget.fieldName].push(self.apos.attachment.url(info, {
              size: 'original'
            }));
          }
        }
      }
    };
  },
  extendMethods (self) {
    return {
      async output(_super, req, widget, options, _with) {
        return _super(
          req,
          {
            ...widget,
            allowMultiple: widget.allowMultiple ?? true,
            fileSizeUnits: {
              B: req.t('aposForm:fileSizeUnitB'),
              KB: req.t('aposForm:fileSizeUnitKB'),
              MB: req.t('aposForm:fileSizeUnitMB'),
              GB: req.t('aposForm:fileSizeUnitGB')
            }
          },
          options,
          _with
        );
      }
    };
  }
};

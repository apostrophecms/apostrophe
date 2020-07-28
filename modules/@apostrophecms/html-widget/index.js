// Provides the "raw HTML widget" (the `@apostrophecms/html` widget).
// Use of this widget is not recommended if it can be avoided. The
// improper use of HTML can easily break pages. If a page becomes
// unusable, add `?safe_mode=1` to the URL to make it work temporarily
// without the offending code being rendered.

module.exports = {
  extend: '@apostrophecms/widget-type',
  options: { label: 'Raw HTML' },
  fields: {
    add: {
      code: {
        type: 'string',
        label: 'Raw HTML (Code)',
        textarea: true,
        help: 'Be careful when embedding third-party code, as it can break the website editing functionality. If a page becomes unusable, add "?safe_mode=1" to the URL to make it work temporarily without the problem code being rendered.'
      }
    }
  },
  methods(self, options) {
    return {
      components(self, options) {
        return {
          render(req, data) {
            // Be understanding of the panic that is probably going on in a user's mind as
            // they try to remember how to use safe mode. -Tom
            const safeModeVariations = [
              'safemode',
              'safeMode',
              'safe_mode',
              'safe-mode',
              'safe mode'
            ];
            if (req.xhr) {
              return {
                render: false
              };
            }
            if (req.query) {
              let safe = false;
              for (const variation of safeModeVariations) {
                if (Object.keys(req.query).includes(variation)) {
                  safe = true;
                  break;
                }
              }
              if (safe) {
                return {
                  render: 'safeMode'
                };
              }
            }
            return {
              render: true,
              code: data.code
            };
          }
        };
      }
    };
  }
};

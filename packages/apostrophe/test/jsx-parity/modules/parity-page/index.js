module.exports = {
  extend: '@apostrophecms/page-type',
  fields: {
    add: {
      main: {
        type: 'area',
        options: {
          widgets: {
            '@apostrophecms/rich-text': {},
            '@apostrophecms/image': {},
            '@apostrophecms/video': {},
            '@apostrophecms/html': {},
            '@apostrophecms/file': {},
            '@apostrophecms/layout': {}
          }
        }
      },
      subtitle: {
        type: 'string'
      }
    }
  }
};

// Something injected at each kind of position, rendered by `inject`.
module.exports.init = (self) => {
  self.prependNodes('main', 'mainNodes');
  self.appendNodes('head', 'headNodes');
};
module.exports.methods = (self) => ({
  mainNodes(req) {
    return [ {
      name: 'div',
      attrs: { class: 'injected-node' },
      body: [ { text: 'Injected & escaped' } ]
    } ];
  },
  headNodes(req) {
    return [ {
      name: 'meta',
      attrs: {
        name: 'injected',
        content: 'yes'
      }
    } ];
  }
});

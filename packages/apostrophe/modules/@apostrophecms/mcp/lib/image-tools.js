// The MCP server's own tools: the media library's images, which the
// harness's tools don't cover. Tagged `mcp`, so only the `mcp` door selects
// them; the assistant has its own attachment handling, in the chat.

module.exports = (self) => {
  return {
    // Registers the image tools on the engine
    addImageTools() {
      const locale = getLocale();
      self.apos.ai.addTool({
        name: 'save_image_to_media',
        label: 'apostrophe:aiToolSaveImageToMedia',
        description: 'Add an image to the media library, from the file\'s bytes as ' +
          `base64, up to ${self.formatSize(self.options.maxImageSize)}. The image ` +
          'is live at once. The result gives its id, for image widgets and ' +
          'relationships to images.',
        input: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              minLength: 1,
              description: 'The file\'s bytes as base64; a "data:" URL also works'
            },
            fileName: {
              type: 'string',
              minLength: 1,
              description: 'A file name with its extension, such as "team-photo.jpg"'
            },
            title: {
              type: 'string',
              minLength: 1
            },
            alt: {
              type: 'string',
              minLength: 1,
              description: 'Alt text: what the image shows, for people who can\'t see it'
            },
            ...locale
          },
          required: [ 'data', 'fileName', 'title', 'alt' ],
          additionalProperties: false
        },
        kind: 'action',
        tags: [ 'mcp' ],
        handler: '@apostrophecms/mcp:saveImageToMedia'
      });
      self.apos.ai.addTool({
        name: 'get_image',
        label: 'apostrophe:aiToolGetImage',
        description: 'Read an image from the media library: its title, alt text, ' +
          'dimensions and file type, and links to the file in a few sizes. The ' +
          'links are only text: to see the image, open one, which works only if ' +
          'you can reach the site.',
        input: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              minLength: 1,
              description: 'An image\'s id'
            }
          },
          required: [ '_id' ],
          additionalProperties: false
        },
        kind: 'query',
        tags: [ 'mcp' ],
        handler: '@apostrophecms/mcp:getImage'
      });

      // The `locale` argument, only in a project with several locales, as
      // the harness's create tools take it
      function getLocale() {
        const names = self.apos.harness.getLocaleNames();
        return (names.length > 1)
          ? {
            locale: {
              type: 'string',
              enum: names,
              description: 'The locale to add it in; the current one when omitted'
            }
          }
          : {};
      }
    }
  };
};

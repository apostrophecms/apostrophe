const widgets = require('../../lib/widgets');

module.exports = {
  extend: '@apostrophecms/widget-type',
  fields: {
    add: {
      container_narrow: {
        type: 'boolean',
        label: 'Container width narrow',
        def: false
      },
      title: {
        type: 'string',
        label: 'Title'
      },
      subtitle: {
        type: 'string',
        label: 'Subtitle'
      },
      subtitle_above: {
        type: 'boolean',
        label: 'Show subtitle above title',
        def: false
      },
      titleColor: {
        label: 'Title Color',
        type: 'string',
        def: '#F0E8DB'
      },
      subtitleColor: {
        label: 'Subtitle Color',
        type: 'string',
        def: '#F0E8DB'
      },
      blurb: {
        type: 'string',
        textarea: true,
        label: 'Blurb'
      },
      blurbColor: {
        label: 'Subtitle Color',
        type: 'string',
        def: '#F0E8DB'
      },
      _image: {
        type: 'relationship',
        label: 'Image',
        max: 1,
        withType: '@apostrophecms/image'
      },
      videoURL: {
        label: 'Video URL',
        type: 'string'
      },
      useMobileImage: {
        label: 'Use image instead of video on mobile?',
        type: 'boolean',
        def: false,
        help: 'If enabled, the uploaded mobile image will replace the video on mobile devices. Video will still show on desktop.'
      },
      lazyLoad: {
        label: 'Enable lazy loading for images',
        help: 'When enabled, images will load as they come into view, improving page performance. Disable if you need images to load immediately.',
        type: 'boolean',
        def: true
      },
      _mobileImage: {
        label: 'Mobile Image',
        type: 'relationship',
        group: 'image',
        max: 1,
        withType: '@apostrophecms/image',
        if: {
          useMobileImage: true
        }
      },
      position: {
        label: 'Image Position',
        type: 'select',
        def: 'center',
        choices: [
          {
            label: 'Select',
            value: null
          },
          {
            label: 'Center',
            value: 'center'
          },
          {
            label: 'Center Top',
            value: 'center top'
          },
          {
            label: 'Bottom-right',
            value: 'bottom right'
          },
          {
            label: 'Bottom-left',
            value: 'bottom left'
          },
          {
            label: 'Top-right',
            value: 'top right'
          },
          {
            label: 'Top-left',
            value: 'top left'
          }
        ]
      },
      one: {
        type: 'area',
        options: {
          widgets
        }
      },
      two: {
        type: 'area',
        options: {
          widgets
        }
      },
      three: {
        type: 'area',
        options: {
          widgets
        }
      },
      four: {
        type: 'area',
        options: {
          widgets
        }
      }
    }
  }
};

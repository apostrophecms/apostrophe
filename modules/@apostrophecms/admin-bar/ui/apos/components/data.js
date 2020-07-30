export default {
  menu: [
    {
      label: 'Content',
      name: 'content',
      menu: true,
      items: [
        {
          label: 'Sandwich artists',
          name: 'sandwich-artists',
          action: 'sandwich-manager'
        },
        {
          label: 'Trees',
          name: 'trees',
          action: 'trees-manager'
        }
      ]
    },
    {
      label: 'Media',
      name: 'media',
      menu: true,
      items: [
        {
          label: 'Files',
          name: 'files',
          action: 'files-manager'
        },
        {
          label: 'Images',
          name: 'images',
          action: 'image-manager'
        }
      ]
    },
    {
      label: 'Log out',
      name: 'logOut',
      options: {
        href: '#logout'
      }
    }
  ]
};

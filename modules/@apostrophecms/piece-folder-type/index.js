module.exports = {
  options: {
    extend: '@apostrophecms/piece-type'
  },
  label: 'apostrophe:folder',
  pluralLabel: 'apostrophe:folders',
  fields(self) {
    return {
      add: {
        _parent: {
          // Not required because there are root folders
          // (plural)
          type: 'relationship',
          max: 1
        },
        _childFolders: {
          type: 'relationshipReverse',
          withType: self.__meta.name,
          reverseOf: '_parent'
        },
        // _children contains the target piece type, not subfolders
        _children: {
          type: 'relationshipReverse',
          withType: self.__meta.name.replace(/\-folder$/, ''),
          reverseOf: '_parent',
          projection: {
            title: 1,
            attachment: 1
          }
        }
      }
    }
  }
}

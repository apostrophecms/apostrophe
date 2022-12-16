import ListItem from '@tiptap/extension-list-item';
export default (options) => {
  return ListItem.extend({
    content: 'defaultNode block*'
  });
};

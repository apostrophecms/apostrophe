import Table from '@tiptap/extension-table';

export default (options) => {
  return Table.configure({
    HTMLAttributes: {},
    resizable: true,
    handleWidth: 5,
    cellMinWidth: 25,
    lastColumnResizable: true,
    allowTableNodeSelection: true
  });
};

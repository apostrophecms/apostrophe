module.exports = ({ header, rows }) => {
  return {
    type: 'table',
    withHeaderRow: true,
    content: [
      {
        type: 'tableRow',
        content: header.map((head) => ({
          type: 'tableHeader',
          content: [ {
            type: 'paragraph',
            content: head
              ? [ {
                type: 'text',
                text: head
              } ]
              : []
          } ]
        }))
      },
      ...rows.map((row) => ({
        type: 'tableRow',
        content: row.map((cell) => ({
          type: 'tableCell',
          content: [
            {
              type: 'paragraph',
              content: cell
                ? [ {
                  type: 'text',
                  text: cell
                } ]
                : []
            }
          ]
        }))
      }))
    ]
  };
};

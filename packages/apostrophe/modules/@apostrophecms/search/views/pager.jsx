// The JSX version of `pager.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({ currentPage, totalPages, url }, { Template }) {
  return (
    <Template
      templateName='@apostrophecms/pager:pager.jsx'
      page={currentPage}
      total={totalPages}
      url={url}
    />
  );
}

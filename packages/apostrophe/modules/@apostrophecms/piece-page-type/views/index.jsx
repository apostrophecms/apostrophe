// The JSX version of `index.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({
  outerLayout, page, pieces, currentPage, totalPages, url
}, { Extend, Template }) {
  return (
    <Extend
      templateName={outerLayout}
      title={page?.title}
      main={
        <>
          {(pieces || []).map((piece) => (
            <h2><a href={piece._url ?? ''}>{piece.title}</a></h2>
          ))}
          <Template
            templateName='@apostrophecms/pager:pager.jsx'
            page={currentPage}
            total={totalPages}
            url={url}
          />
        </>
      }
    />
  );
}

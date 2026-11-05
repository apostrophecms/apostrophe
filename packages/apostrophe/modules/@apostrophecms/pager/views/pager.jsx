// A classic pager, easily styled: the JSX counterpart of the `render` macro
// of `macros.html`. Props: `page` (the current page), `total` (the number of
// pages), `url` (the URL to add the page number to), and optionally `class`
// and `shown` (how many page numbers to show around the current one,
// default 5).
//
//   <Template templateName='@apostrophecms/pager:pager.jsx'
//     page={currentPage} total={totalPages} url={url} />

function PagerPage({
  page, options, pagerClass, url, apos
}) {
  if (page > options.total) {
    return null;
  }
  const pageClass = pagerClass ? `${pagerClass}__item` : '';
  const classes = pageClass +
    ((page === 1) ? '  is-first' : '') +
    ((page === options.total) ? ' is-last' : '') +
    ((page === options.page) ? ' is-active' : '');
  return (
    <span className={classes}>
      {(options.page !== page)
        ? <a href={apos.url.build(url, { page })}>{page}</a>
        : page}
    </span>
  );
}

export default function (data, { apos, helpers }) {
  const options = {
    page: data.page,
    total: data.total,
    class: data.class,
    shown: data.shown
  };
  const { url } = data;
  if (!((options.page > 1) || (options.total > 1))) {
    return null;
  }
  const pager = helpers.modules['@apostrophecms/pager'];
  const pagerClass = options.class;
  const gapClass = pagerClass ? `${pagerClass}__gap` : '';
  const props = {
    options,
    pagerClass,
    url,
    apos
  };
  return (
    <div className={pagerClass || ''}>
      <PagerPage page={1} {...props} />
      {pager.showHeadGap(options) && <span className={gapClass}>&hellip;</span>}
      {pager.pageRange({
        page: options.page,
        total: options.total,
        shown: options.shown || 5
      }).map((page) => ((page > 1) && (page < options.total)) && (
        <PagerPage page={page} {...props} />
      ))}
      {pager.showTailGap(options) && <span className={gapClass}>&hellip;</span>}
      <PagerPage page={options.total} {...props} />
    </div>
  );
}

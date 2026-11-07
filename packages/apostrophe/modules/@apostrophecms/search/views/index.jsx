// The JSX version of `index.html`, used when the `jsx` option of
// @apostrophecms/template is set.
export default function ({
  outerLayout, page, url, filters, query, docs
}, { Extend, Template, __t }) {
  return (
    <Extend
      templateName={outerLayout}
      title={page?.title}
      main={
        <>
          <form data-apos-search-page-form method='GET' action={`${url ?? ''}#main`}>
            {filters && (
              <>
                <div className='ld-meta'>{__t('apostrophe:filterResultsByType')}</div>
                <ul>
                  {filters.map((filter) => (
                    <li>
                      <input
                        data-apos-search-filter
                        type='checkbox'
                        name={filter.name ?? ''}
                        checked={Boolean(filter.value)}
                        value='1'
                      />
                      {filter.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className='ld-meta'>{__t('apostrophe:newSearch')}</div>
            <input type='search' data-apos-search-field value={query?.q ?? ''} name='q' />
            <input type='submit' value='Search' />
          </form>
          <Template templateName='@apostrophecms/search:results.jsx' docs={docs} />
          <Template templateName='@apostrophecms/search:pager.html' />
        </>
      }
    />
  );
}

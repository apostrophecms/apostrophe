// The search results, shared by the JSX versions of the search templates.
export default function ({ docs }) {
  return (docs || []).map((doc) => (
    <h4>{doc._url ? <a href={doc._url}>{doc.title}</a> : doc.title}</h4>
  ));
}

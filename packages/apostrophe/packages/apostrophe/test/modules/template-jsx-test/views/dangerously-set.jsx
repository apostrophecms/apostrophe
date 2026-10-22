export default function (data) {
  return <div dangerouslySetInnerHTML={{ __html: data.html }} />;
}

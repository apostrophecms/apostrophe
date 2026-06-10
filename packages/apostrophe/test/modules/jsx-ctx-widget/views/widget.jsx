export default function (data) {
  const tag = (data.contextOptions && data.contextOptions.tag) || 'no-tag';
  return <span class='ctx-widget' data-tag={tag}>{tag}</span>;
}

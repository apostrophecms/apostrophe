export default function (data, { Template }) {
  return (
    <div>
      <Template templateName='include-target.html' content='prop-content' />
    </div>
  );
}

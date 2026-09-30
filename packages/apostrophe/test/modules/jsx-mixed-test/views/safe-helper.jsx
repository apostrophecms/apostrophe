export default function (data, { helpers }) {
  return <div>{helpers.modules['jsx-mixed-test'].safeBold('hello & <world>')}</div>;
}

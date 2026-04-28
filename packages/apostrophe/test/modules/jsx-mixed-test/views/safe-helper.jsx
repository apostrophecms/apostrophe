export default function (data, { apos }) {
  return <div>{apos.modules['jsx-mixed-test'].safeBold('hello & <world>')}</div>;
}

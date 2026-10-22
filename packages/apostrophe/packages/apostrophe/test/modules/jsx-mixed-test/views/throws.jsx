export default function () {
  // intentionally accesses a property of undefined to trigger an error
  const data = undefined;
  return <p>{data.boom}</p>;
}

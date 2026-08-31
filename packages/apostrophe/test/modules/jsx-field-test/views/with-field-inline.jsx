export default function (data, { Field }) {
  return (
    <p>Name: <Field doc={data.piece} name='name' />.</p>
  );
}

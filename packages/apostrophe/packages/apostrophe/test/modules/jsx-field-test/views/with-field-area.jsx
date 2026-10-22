export default function (data, { Field }) {
  return (
    <main>
      <Field doc={data.piece} name='main' />
    </main>
  );
}

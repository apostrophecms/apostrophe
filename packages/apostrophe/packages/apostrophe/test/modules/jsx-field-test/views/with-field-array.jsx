export default function (data, { Field }) {
  return (
    <main>
      {data.piece.sections.map(section => (
        <section key={section._id}>
          <Field doc={section} name='caption' with={{ tag: 'h2' }} />
        </section>
      ))}
    </main>
  );
}

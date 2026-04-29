export default function (data, { Extend }) {
  return (
    <Extend
      templateName='njk-layout.html'
      title='A JSX page'
      main={
        <main>
          <h1>I am from JSX</h1>
          <p>{data.message}</p>
        </main>
      }
    />
  );
}

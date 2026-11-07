export default function ({ outerLayout, message }, { Extend }) {
  return (
    <Extend
      templateName={outerLayout}
      title='JSX page'
      main={<p className='jsx-main'>{message}</p>}
    />
  );
}

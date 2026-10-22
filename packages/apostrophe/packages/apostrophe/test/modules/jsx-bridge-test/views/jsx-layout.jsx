export default function (data) {
  return (
    <html>
      <head>
        <title>{data.title || 'default title'}</title>
      </head>
      <body>
        <header>shared header</header>
        {data.children}
        <footer>shared footer</footer>
      </body>
    </html>
  );
}

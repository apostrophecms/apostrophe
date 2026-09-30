export default function (data) {
  return (
    <p
      data-name={String(data.name)}
      data-template-name={String(data.templateName)}
    />
  );
}

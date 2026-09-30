export default async function (data, { apos, helpers }) {
  const id = apos.util.generateId();
  // apos.doc.find returns a real cursor we can await. apos.doc here is the
  // doc-module instance from self.apos, not a helper bag.
  const docs = await apos.doc.find(data.req, { type: '@apostrophecms/global' }).toArray();
  // The doc module instance has methods (e.g. find) that the helper bag
  // does not — and the two `modules` collections are different objects.
  const aposDocIsModule = typeof apos.doc.find === 'function';
  const helpersDocIsHelperBag = (apos.doc !== helpers.modules['@apostrophecms/doc']);
  const aposModulesIsNotHelpersModules = (apos.modules !== helpers.modules);
  return (
    <div
      data-id-length={String(id.length)}
      data-global-count={String(docs.length)}
      data-distinct={String(apos !== helpers)}
      data-apos-doc-is-module={String(aposDocIsModule)}
      data-helpers-doc-is-helper-bag={String(helpersDocIsHelperBag)}
      data-modules-distinct={String(aposModulesIsNotHelpersModules)}
    />
  );
}

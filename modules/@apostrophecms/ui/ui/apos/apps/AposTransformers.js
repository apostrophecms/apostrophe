export default () => {
  apos.ui.transformers = {};
  // Register a transformer. Transformers can be
  // used as part of a modal name with apos.modal.execute,
  // separated by pipes. Transformers accept the props
  // given to the modal and transform them, returning
  // a new object of props. The last object is passed
  // to the actual modal component
  apos.ui.addTransformer = (name, fn) => {
    apos.ui.transformers[name] = fn;
  };
};

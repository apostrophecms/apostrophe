export default () => {
  apos.aposForm.collectors['@apostrophecms/form-textarea-field'] = {
    selector: '[data-apos-form-textarea]',
    collector (el) {
      const input = el.querySelector('textarea');

      return {
        field: input.getAttribute('name'),
        value: input.value
      };
    }
  };
};

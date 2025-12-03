export default () => {
  apos.aposForm.collectors['@apostrophecms/form-text-field'] = {
    selector: '[data-apos-form-text]',
    collector (el) {
      const input = el.querySelector('input');

      return {
        field: input.getAttribute('name'),
        value: input.value
      };
    }
  };
};

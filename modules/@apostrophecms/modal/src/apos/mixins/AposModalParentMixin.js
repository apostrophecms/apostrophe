/*
Components that use AposModal, such as AposMediaManager and AposDocEditor
need to be set up to handle opening and closing the modal. Since the
AposModal component has its own mechanisms to handle that transition, these
parent components should initiate that transition on mount.

They should also emit a `safe-close` event after the modal is completely
closed (`modal.active` is set to `false`), at which point they themselves can
be destroyed however necessary.
*/
export default {
  methods: {
    cancel() {
      this.modal.showModal = false;
    }
  }
};

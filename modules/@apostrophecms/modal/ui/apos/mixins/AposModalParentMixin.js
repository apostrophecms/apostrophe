/*
Components that use AposModal, such as AposMediaManager and AposDocEditor
need to be set up to handle opening and closing the modal. Since the
AposModal component has its own mechanisms to handle that transition, these
parent components should initiate that transition on mount.

They should also emit a `safe-close` event after the modal is completely
closed (`modal.active` is set to `false`), at which point they themselves can
be destroyed however necessary.

If the modal parent sets `this.modified` to true, a confirmation prompt will
appear on attempts to click cancel or use the esc key to close the modal.
The labels can be overridden by overriding data properties as shown below.
*/
export default {
  data() {
    return {
      cancelHeading: 'Unsaved Changes',
      cancelDescription: 'Do you want to discard changes?',
      cancelNegativeLabel: 'Resume Editing',
      cancelAffirmativeLabel: 'Discard Changes',
      modified: false
    };
  },
  methods: {
    async cancel() {
      if (this.modified) {
        const discard = await apos.confirm({
          heading: this.cancelHeading,
          description: this.cancelDescription,
          negativeLabel: this.cancelNegativeLabel,
          affirmativeLabel: this.cancelAffirmativeLabel
        });
        if (discard) {
          await apos.notify('Changes discarded', {
            dismiss: true
          });
        } else {
          return;
        }
      }
      this.modal.showModal = false;
    }
  }
};

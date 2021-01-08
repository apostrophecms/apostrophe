/*
 * Provides a `confirmAndCancel` method which prompts for confirmation if
 * `this.isModified` returns true. Your component must supply that method.
 *
 * The labels can be overridden by overriding data properties as shown below.
 *
 * If the cancellation is confirmed, or if `this.modified` is not true,
 * the modal is closed.
 */

export default {
  data() {
    return {
      cancelHeading: 'Unsaved Changes',
      cancelDescription: 'Do you want to discard changes?',
      cancelNegativeLabel: 'Resume Editing',
      cancelAffirmativeLabel: 'Discard Changes'
    };
  },
  methods: {
    async confirmAndCancel() {
      let dismiss;
      if (this.isModified) {
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
          dismiss = true;
        } else {
          dismiss = false;
        }
      } else {
        dismiss = true;
      }
      if (dismiss) {
        this.modal.showModal = false;
      }
    }
  }
};

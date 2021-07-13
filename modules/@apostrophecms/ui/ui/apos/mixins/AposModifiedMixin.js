/*
 * Provides a `confirmAndCancel` method which prompts for confirmation if
 * `this.isModified` returns true. Your component must supply that method.
 *
 * If your component has a `modal` property, which is normal for modals,
 * it will close automatically on confirmation. If your component does not have a
 * `modal` property then you must implement your own `close` method.
 *
 * The labels can be overridden by overriding data properties as shown below.
 *
 * If the cancellation is confirmed, or if `this.modified` is not true,
 * the component is closed.
 */

export default {
  data() {
    return {
      cancelHeading: 'apostrophe:unsavedChanges',
      cancelDescription: 'apostrophe:discardChangesPrompt',
      cancelNegativeLabel: 'apostrophe:resumeEditing',
      cancelAffirmativeLabel: 'apostrophe:discardChanges'
    };
  },
  methods: {
    // Returns true if the cancellation does occur
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
          await apos.notify('apostrophe:changesDiscarded', {
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
        if (this.modal) {
          this.modal.showModal = false;
        } else {
          this.close();
        }
      }
      return dismiss;
    }
  }
};


import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';

export default {
  name: 'AposInputAttachment',
  mixins: [ AposInputMixin ],
  emits: [ 'upload-started', 'upload-complete' ],
  data () {
    return {
      // Next should consistently be an object or null (an attachment field with
      // no value yet is null, per server side).
      next: (this.modelValue && (typeof this.modelValue.data === 'object'))
        ? this.modelValue.data : (this.field.def || null),
      disabled: false,
      uploading: false
    };
  },
  async mounted () {
    this.disabled = this.field.readOnly;
  },
  methods: {
    updated (items) {
      // NOTE: This is limited to a single item.
      this.next = items.length > 0 ? items[0] : null;
    },
    validate (value) {
      if (this.field.required && !value) {
        return 'required';
      }

      return false;
    },
    async uploadMedia (file) {
      if (!this.disabled || !this.limitReached) {
        try {
          this.disabled = true;
          this.uploading = true;

          await apos.notify('apostrophe:uploading', {
            dismiss: true,
            icon: 'cloud-upload-icon',
            interpolate: {
              name: file.name
            }
          });

          const formData = new window.FormData();
          formData.append('file', file);
          const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
            body: formData
          });

          await apos.notify('apostrophe:uploaded', {
            type: 'success',
            dismiss: true,
            icon: 'check-all-icon',
            interpolate: {
              name: file.name,
              count: 1
            }
          });

          this.$emit('upload-complete');
          this.modelValue.data = attachment;
        } catch (error) {
          console.error('Error uploading file.', error);
          const msg = error.body && error.body.message ? error.body.message : this.$t('apostrophe:uploadError');
          await apos.notify(msg, {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true,
            localize: false
          });
        } finally {
          this.disabled = false;
          this.uploading = false;
        }
      }
    }
  }
};

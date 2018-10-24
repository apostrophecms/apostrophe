<fieldset :class="cssClass" :data-name="name">
  <label class="apos-field-label">{{ field.label }}</label>
  <div v-if="field.help" class="apos-field-help">{{ field.help }}</div>
  <template slot="body"></template>
</fieldset>

<script>
// A component designed to be used as a scaffold for
// ApostropheStringField and friends, which override the `body`
// slot
export default {
  name: 'ApostropheFieldset',
  props: {
    field: Object
  },
  computed: {
    cssClass() {
      return `apos-field apos-field-${this.field.type} apos-field-${this.field.name} ${this.field.classes}`;
    }
  }
};
</script>
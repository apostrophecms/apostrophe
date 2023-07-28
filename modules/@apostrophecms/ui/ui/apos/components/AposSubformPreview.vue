<template>
  <div class="apos-subform-preview">
    <div class="apos-subform-preview__label">
      {{ $t(subform.label || subform.schema?.[0].label || 'n/a') }}
    </div>
    <div class="apos-subform-preview__value" :class="{ 'is-help': !!subform.help }">
      <component
        v-if="subform.previewComponent"
        :is="subform.previewComponent"
        :subform="subform"
        :values="values"
      />
      <span v-else>
        {{ previewValue }}
      </span>
    </div>
  </div>
</template>
<script>
export default {
  name: 'AposSubformPreview',
  props: {
    subform: {
      type: Object,
      required: true
    },
    values: {
      type: Object,
      required: true
    }
  },
  computed: {
    previewValue() {
      if (this.subform.help) {
        return this.$t(this.subform.help);
      }
      let preview = this.subform.preview;
      const values = inferFieldValues(this.subform.schema, this.values, this.$t);

      if (!preview) {
        preview = this.subform.fields
          .map(field => `{{ ${field} }}`)
          .join(' ');
      }
      return this.$t(preview, values);
    }
  }
};

function inferFieldValues(schema, values, $t) {
  const result = {};
  for (const field of schema) {
    const value = values[field.name];
    if (typeof value === 'undefined' && field.def) {
      result[field.name] = field.def;
      continue;
    }

    if (value === null) {
      continue;
    }

    switch (field.type) {
      case 'password': {
        result[field.name] = '********';
        break;
      }

      case 'boolean': {
        result[field.name] = field.toggle
          ? $t(field.toggle[value])
          : $t(value ? 'apostrophe:yes' : 'apostrophe:no');
        break;
      }

      case 'radio':
      case 'select': {
        result[field.name] = field.choices
          .filter(choice => choice.value === value)
          .map(choice => $t(choice.label))
          .join(', ');
        break;
      }

      case 'checkbox': {
        const labels = [];
        for (const choice of field.choices) {
          if ((value || []).includes(choice.value)) {
            labels.push(choice.label);
          }
        }
        result[field.name] = labels.join(', ');
        break;
      }

      default: {
        const type = typeof value;
        result[field.name] = [ 'string', 'number' ].includes(type)
          ? value
          : '';
        break;
      }
    }
  }

  return result;
}
</script>
<style lang="scss" scoped>
.apos-subform-preview {
  display: grid;
  grid-template-columns: 1fr 2fr;
  padding: $spacing-double 0;
  align-items: center;

  &__value {
    @include type-large;
    line-height: 1;

    > span {
      display: inline-block;
    }
  }

  &__value.is-help,
  &__label {
    @include type-base;

    display: inline-block;
    color: var(--a-base-3);
    line-height: 1;
  }
}
</style>
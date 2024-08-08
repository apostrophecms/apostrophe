<template>
  <div class="apos-subform-preview">
    <div class="apos-subform-preview__label">
      {{ $t(subform.label || subform.schema?.[0].label || 'n/a') }}
    </div>
    <div class="apos-subform-preview__value" :class="{ 'is-help': !!subform.help }">
      <component
        :is="subform.previewComponent"
        v-if="subform.previewComponent"
        class="apos-subform-preview__value-block"
        :subform="subform"
        :values="values"
      />
      <span v-else class="apos-subform-preview__value-block">
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
          .map(choice => $t(choice.label))[0] || '';
        break;
      }

      case 'checkbox': {
        const labels = [];
        for (const choice of field.choices) {
          if ((value || []).includes(choice.value)) {
            labels.push($t(choice.label));
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
  align-items: center;
  padding: $spacing-double 0;
  grid-template-columns: 1fr 2fr;

  &__value {
    @include type-base;

    & {
      line-height: 1;
      // color: var(--a-base-1);
      color: var(--a-text-primary);
    }
  }

  &__value-block {
    display: inline-block;
  }

  &__value.is-help,
  &__label {
    @include type-base;

    & {
      display: inline-block;
      line-height: 1;
      color: var(--a-base-3);
    }
  }
}
</style>

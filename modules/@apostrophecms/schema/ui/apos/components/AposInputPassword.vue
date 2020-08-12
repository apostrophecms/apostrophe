<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="error" :uid="uid"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <input
          type="password"
          class="apos-input apos-input--password"
          v-model="next"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          :required="field.required"
          :id="uid"
          :tabindex="tabindex"
          @keydown.enter="$emit('return')"
        >
        <component
          v-if="icon"
          :size="iconSize"
          class="apos-input-icon"
          :is="icon"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin';

export default {
  name: 'AposInputPassword',
  mixins: [ AposInputMixin ],
  emits: ['return'],
  computed: {
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    },
    icon () {
      if (this.error) {
        return 'circle-medium-icon';
      } else if (this.field.type === 'date') {
        return 'calendar-icon';
      } else if (this.field.type === 'time') {
        return 'clock-icon';
      } else if (this.field.icon) {
        return this.field.icon;
      } else {
        return null;
      }
    }
  },
  methods: {
    validate(value) {
      if (this.field.required) {
        if (!value.length) {
          return 'required';
        }
      }
      if (this.field.min) {
        if (value.length && (value.length < this.field.min)) {
          return 'min';
        }
      }
      if (this.field.max) {
        if (value.length && (value.length > this.field.max)) {
          return 'max';
        }
      }
      return false;
    }
  }
};
</script>


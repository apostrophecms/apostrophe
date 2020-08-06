<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="error" :uid="uid"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <textarea
          :class="classes"
          v-if="field.textarea" rows="5"
          v-model="next" :placeholder="field.placeholder"
          @keydown.enter="$emit('return')"
          :disabled="field.disabled" :required="field.required"
          :id="uid" :tabindex="tabindex"
        />
        <input
          v-else :class="classes"
          v-model="next" :type="type"
          :placeholder="field.placeholder"
          @keydown.enter="$emit('return')"
          :disabled="field.disabled" :required="field.required"
          :id="uid" :tabindex="tabindex"
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
  name: 'AposInputString',
  mixins: [ AposInputMixin ],
  emits: ['return'],
  computed: {
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    },
    type () {
      if (this.field.type) {
        return this.field.type;
      } else {
        return 'text';
      }
    },
    classes () {
      return ['apos-input', `apos-input--${this.type}`];
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

<style lang="scss" scoped>
  .apos-input--date,
  .apos-input--time {
    // lame magic number ..
    // height of date/time input is slightly larger than others due to the browser spinner ui
    height: 46px;
  }
  .apos-input--date {
    // padding is lessend to overlap with calendar UI
    padding-right: $input-padding * 1.4;
    &::-webkit-calendar-picker-indicator { opacity: 0; }
    &::-webkit-clear-button {
      position: relative;
      right: 5px;
    }
  }
  .apos-input--time {
    padding-right: $input-padding * 2.5;
  }

  .apos-field--small .apos-input--date,
  .apos-field--small .apos-input--time {
    height: 33px;
  }
</style>

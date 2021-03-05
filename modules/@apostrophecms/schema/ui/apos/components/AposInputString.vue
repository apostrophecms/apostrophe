<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <textarea
          :class="classes"
          v-if="field.textarea && field.type === 'string'" rows="5"
          v-model="next" :placeholder="field.placeholder"
          @keydown.enter="enterEmit"
          :disabled="field.disabled" :required="field.required"
          :id="uid" :tabindex="tabindex"
        />
        <input
          v-else :class="classes"
          v-model="next" :type="type"
          :placeholder="field.placeholder"
          @keydown.enter="enterEmit"
          :disabled="field.disabled" :required="field.required"
          :id="uid" :tabindex="tabindex"
          :step="step"
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
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputString',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data () {
    return {
      step: undefined
    };
  },
  computed: {
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    },
    type () {
      if (this.field.type) {
        if (this.field.type === 'float' || this.field.type === 'integer') {
          return 'number';
        }
        if (this.field.type === 'string' || this.field.type === 'slug') {
          return 'text';
        }
        return this.field.type;
      } else {
        return 'text';
      }
    },
    classes () {
      return [ 'apos-input', `apos-input--${this.type}` ];
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
  watch: {
    followingValues: {
      // We may be following multiple fields, like firstName and lastName,
      // or none at all, depending
      deep: true,
      handler(newValue, oldValue) {
        // Follow the value of the other field(s), but only if our
        // previous value matched the previous value of the other field(s)
        oldValue = Object.values(oldValue).join(' ').trim();
        newValue = Object.values(newValue).join(' ').trim();
        if (((this.next == null) || (!this.next.length)) || (this.next === oldValue)) {
          this.next = newValue;
        }
      }
    }
  },
  mounted() {
    this.defineStep();
  },
  methods: {
    enterEmit() {
      if (this.field.enterSubmittable) {
        // Include the validated results in cases where an Enter keydown should
        // act as submitting a form.
        this.$emit('return', {
          data: this.next,
          error: this.validate(this.next)
        });
      } else {
        this.$emit('return');
      }
    },
    validate(value) {
      if (value == null) {
        value = '';
      }
      if (this.field.required) {
        if (typeof value === 'string' && !value.length) {
          return 'required';
        }
      }

      const minMaxFields = [
        'integer',
        'float',
        'range',
        'string',
        'date',
        'password'
      ];

      if (this.field.min && minMaxFields.includes(this.field.type)) {
        if (value.length && (this.convert(value) < this.field.min)) {
          return 'min';
        }
      }
      if (this.field.max && minMaxFields.includes(this.field.type)) {
        if (value.length && (this.convert(value) > this.field.max)) {
          return 'max';
        }
      }
      if (this.field.type === 'email' && value) {
        // regex source: https://emailregex.com/
        const matches = value.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
        if (!matches) {
          return 'invalid';
        }
      }
      return false;
    },
    defineStep() {
      if (this.type === 'number') {
        this.step = this.field.type === 'float' ? 'any' : 1;
      }
    },
    convert(s) {
      if ([ 'integer', 'range' ].includes(this.field.type)) {
        return parseInt(s);
      } else if (this.field.type === 'float') {
        return parseFloat(s);
      } else {
        return s;
      }
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
    padding-right: calc(#{$input-padding} - 2px);
  }

  .apos-field--small .apos-input--date,
  .apos-field--small .apos-input--time {
    height: 33px;
  }
</style>

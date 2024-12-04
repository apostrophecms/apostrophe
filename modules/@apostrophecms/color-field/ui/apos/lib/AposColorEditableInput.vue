<template>
  <div class="apos-color__editable-input">
    <input
      ref="input"
      v-model="val"
      :aria-labelledby="labelId"
      class="apos-color__input"
      @keydown="handleKeyDown"
      @input="update"
    >
    <span
      :id="labelId"
      :for="label"
      class="apos-color__label"
    >
      {{ labelSpanText }}
    </span>
    <span class="apos-color__desc">
      {{ desc }}
    </span>
  </div>
</template>

<script>
export default {
  name: 'AposColorEditableInput',
  props: {
    label: {
      type: String,
      default: ''
    },
    labelText: {
      type: String,
      default: ''
    },
    desc: {
      type: String,
      default: ''
    },
    // TODO double check default
    value: {
      type: [ String, Number ],
      default: () => {
        return '';
      }
    },
    max: {
      type: Number,
      default: undefined
    },
    min: {
      type: Number,
      default: undefined
    },
    arrowOffset: {
      type: Number,
      default: 1
    }
  },
  emits: [ 'change' ],
  computed: {
    val: {
      get() {
        return this.value;
      },
      set(v) {
        // TODO: min
        if (!(this.max === undefined) && +v > this.max) {
          this.$refs.input.value = this.max;
        } else {
          return v;
        }
      }
    },
    labelId() {
      return `input__label__${this.label}__${Math.random().toString().slice(2, 5)}`;
    },
    labelSpanText() {
      return this.labelText || this.label;
    }
  },
  methods: {
    update(e) {
      this.handleChange(e.target.value);
    },
    handleChange(newVal) {
      const data = {};
      data[this.label] = newVal;
      if (data.hex === undefined && data['#'] === undefined) {
        this.$emit('change', data);
      } else if (newVal.length > 5) {
        this.$emit('change', data);
      }
    },
    handleKeyDown(e) {
      let { val } = this;
      const number = Number(val);

      if (number) {
        const amount = this.arrowOffset || 1;

        // Up
        if (e.keyCode === 38) {
          val = number + amount;
          this.handleChange(val);
          e.preventDefault();
        }

        // Down
        if (e.keyCode === 40) {
          val = number - amount;
          this.handleChange(val);
          e.preventDefault();
        }
      }
    }
  }
};
</script>

<style>
.apos-color__editable-input {
  position: relative;
}

.apos-color__input {
  width: 90%;
  padding: 4px 0 3px 10%;
  border: none;
  font-size: var(--a-type-small);
  outline: none;
  box-shadow: inset 0 0 0 1px var(--a-base-5);
}

.apos-color__label {
  display: block;
  padding-top: 3px;
  padding-bottom: 4px;
  color: var(--a-text-primary);
  font-size: var(--a-type-smaller);
  text-align: center;
  text-transform: capitalize;
}
</style>

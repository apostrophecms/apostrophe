<template>
  <div class="apos-input-wrapper" :class="wrapperClasses">
    <select
      class="apos-input apos-input--select"
      :class="classes"
      :uid="uid"
      :disabled="disabled"
      :autocomplete="autocomplete"
      @change="change($event.target.value)"
    >
      <option
        v-for="choice in choices"
        :key="JSON.stringify(choice.value)"
        :value="JSON.stringify(choice.value)"
        :selected="choice.value === selected"
      >
        {{ $t(choice.label) }}
      </option>
    </select>
    <AposIndicator
      icon="menu-down-icon"
      class="apos-input-icon"
      :icon-size="20"
    />
  </div>
</template>
<script>

export default {
  name: 'AposSelect',
  props: {
    icon: {
      type: String,
      default: 'menu-down-icon'
    },
    uid: {
      type: Number,
      default: null
    },
    classes: {
      type: Array,
      default() {
        return [];
      }
    },
    wrapperClasses: {
      type: Array,
      default() {
        return [];
      }
    },
    choices: {
      type: Array,
      default() {
        return [];
      }
    },
    selected: {
      type: [ String, Number, Boolean ],
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    },
    autocomplete: {
      type: String,
      default: null
    }
  },
  emits: [ 'change' ],
  methods: {
    change(value) {
      this.$emit('change', JSON.parse(value));
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-input-icon {
  @include apos-transition();
}
</style>

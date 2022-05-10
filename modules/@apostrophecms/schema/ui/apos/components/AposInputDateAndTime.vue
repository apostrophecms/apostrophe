<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <AposToggle
          v-if="!field.required"
          v-model="disabled"
          class="apos-toggle"
          @toggle="toggle"
        />
        <input
          v-model="date"
          class="apos-input apos-input--date"
          :class="{'apos-input--disabled': disabled}"
          type="date"
          @change="setDateAndTime"
        >
        <span class="apos-input--label">
          {{ $t('apostrophe:at') }}
        </span>
        <input
          v-model="time"
          class="apos-input apos-input--time"
          :class="{'apos-input--disabled': disabled}"
          type="time"
          @change="setDateAndTime"
        >
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import dayjs from 'dayjs';

export default {
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data() {
    return {
      next: (this.value && this.value.data) || null,
      date: '',
      time: '',
      disabled: !this.field.required
    };
  },
  mounted () {
    this.initDateAndTime();
  },
  methods: {
    toggle() {
      this.disabled = !this.disabled;

      if (this.disabled) {
        this.next = null;
      }
    },
    validate() {
      if (this.field.required && !this.next) {
        return 'required';
      }
    },
    initDateAndTime() {
      if (this.next) {
        this.date = dayjs(this.next).format('YYYY-MM-DD');
        this.time = dayjs(this.next).format('HH:mm:ss');
        this.disabled = false;
      }
    },
    setDateAndTime() {
      if (this.date) {
        this.next = dayjs(`${this.date} ${this.time}`.trim()).toISOString();
        this.disabled = false;
      } else {
        this.next = null;
        this.disabled = true;
      }
    }
  }

};
</script>
<style scoped lang='scss'>
  .apos-input-wrapper {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }

  .apos-toggle {
    margin-right: 12px;
  }

  .apos-input {
    padding: 10px;

    &--disabled {
      background-color: var(--a-white);
      border-color: var(--a-base-8);
      color: var(--a-base-4);
    }

    &--label {
      margin: 0 12px;
      font-family: var(--a-family-default);
    }
  }
</style>

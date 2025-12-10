<template>
  <fieldset
    v-apos-tooltip="tooltip"
    class="apos-breadcrumb-switch"
    :class="{'apos-breadcrumb-switch--disabled': isDisabled}"
  >
    <label
      v-for="choice in enhancedChoices"
      :key="choice.value"
      v-apos-tooltip="choice.tooltip"
      class="apos-breadcrumb-switch__label"
      :for="choice.id"
      :data-apos-test="`bcswitch:${choice.value}`"
    >
      <input
        :id="choice.id"
        v-model="store.data.value"
        class="apos-breadcrumb-switch__input"
        :value="choice.value"
        type="radio"
        :name="uniqueName"
        :disabled="isDisabled"
        @input="input"
      >
      <span class="apos-breadcrumb-switch__input-text">{{ $t(choice.label) }}</span>
    </label>
  </fieldset>
</template>

<script>
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget.js';

export default {
  name: 'AposBreadcrumbSwitch',
  components: { },
  props: {
    widgetId: {
      type: String,
      default: null
    },
    choices: {
      type: Array,
      required: true
    },
    value: {
      type: String,
      default: undefined
    },
    name: {
      type: String,
      required: true
    },
    tooltip: {
      type: Object,
      default: null
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'update' ],
  data() {
    const name = `${this.name}:switch`;
    const widgetStore = useWidgetStore();
    const next = this.value || null;
    return {
      next,
      storeRemove: widgetStore.remove,
      store: widgetStore.getOrSet(this.widgetId, name, next),
      namespace: name
    };
  },
  computed: {
    isDisabled() {
      return this.disabled || this.enhancedChoices.some((choice) => choice.disabled);
    },
    uniqueName() {
      return `${this.name}-${this.widgetId}`;
    },
    enhancedChoices() {
      return this.choices.map(choice => {
        return {
          ...choice,
          id: `${this.uniqueName}-${choice.value}`
        };
      });
    }
  },
  watch: {
    enhancedChoices(choices) {
      const curChoice = choices.find(({ value }) => this.next === value);
      if (!curChoice.disabled) {
        return;
      }

      const nonDisabledChoice = choices.find(choice => !choice.disabled);
      if (nonDisabledChoice) {
        this.update(nonDisabledChoice.value);
        return;
      }

      this.$emit('update', null);
    }
  },
  unmounted() {
    this.storeRemove(this.widgetId, this.namespace);
  },
  methods: {
    input(event) {
      this.next = event.target.value;
      this.update(this.next);
    },
    update(value) {
      const payload = this.choices.find((choice) => choice.value === value);
      this.$emit('update', {
        ...payload,
        name: this.name
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-breadcrumb-switch {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;

  :focus {
    outline: 0;
    box-shadow: 0 0 0 4px #b5c9fc;
  }

  &--disabled {
    .apos-breadcrumb-switch__input:not(:checked) + .apos-breadcrumb-switch__input-text:hover {
      background-color: inherit;
    }

    .apos-breadcrumb-switch__input:not(:checked) + .apos-breadcrumb-switch__input-text {
      background-color: var(--a-white);
      border: none;
      box-shadow: none;
    }

    .apos-breadcrumb-switch__input:checked + .apos-breadcrumb-switch__input-text {
      box-shadow: 0 0 0 1px var(--a-base-5);
      background-color: var(--a-base-5);
      color: var(--a-text-primary);
    }

    .apos-breadcrumb-switch__label {
      opacity: 0.5
    }
  }
}

.apos-breadcrumb-switch__label {
  display: flex;
  align-items: center;

  &:first-child .apos-breadcrumb-switch__input-text {
    left: -1px;
  }

  &:last-child .apos-breadcrumb-switch__input-text {
    right: -1px;
  }
}

  .apos-breadcrumb-switch__input:not(:checked) + .apos-breadcrumb-switch__input-text:hover {
    background-color: var(--a-base-9);
  }

.apos-breadcrumb-switch__input {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(100%);
  white-space: nowrap;

  &:checked + .apos-breadcrumb-switch__input-text {
    box-shadow: 0 0 0 1px var(--a-primary-dark-15);
    background-color: var(--a-primary-transparent-90);
    z-index: $z-index-default;
    color: var(--a-text-inverted);
  }
}

.apos-breadcrumb-switch__input-text {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  height: 100%;
  margin-left: .063em;
  padding: 0 8px;
  color: var(--a-base-1);
  text-align: center;
  transition: background-color 500ms ease;
  cursor: pointer;
  letter-spacing: 0.5px;
  border-radius: 4px;
}
</style>

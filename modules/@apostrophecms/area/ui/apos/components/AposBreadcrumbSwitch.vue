<template>
  <fieldset class="apos-breadcrumb-switch">
    <div>
      <label
        v-for="choice in enhancedChoices"
        :key="choice.value"
        v-apos-tooltip="choice.tooltip"
        :for="choice.id"
        :data-apos-test="`bcswitch:${choice.value}`"
      >
        <input
          :id="choice.id"
          v-model="store.data.value"
          :value="choice.value"
          type="radio"
          :name="uniqueName"
          :disabled="choice.disabled"
          @input="update"
        >
        <span>{{ $t(choice.label) }}</span>
      </label>
    </div>
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
    uniqueName() {
      return `${this.name}-${this.widgetId}`;
    },
    enhancedChoices() {
      return this.choices.map(choice => {
        const tooltip = choice.disabled && choice.disabledTooltip;
        return {
          ...choice,
          id: `${this.uniqueName}-${choice.value}`,
          tooltip
        };
      });
    }
  },
  unmounted() {
    this.storeRemove(this.widgetId, this.namespace);
  },
  methods: {
    update(event) {
      this.next = event.target.value;
      const payload = this.choices.find(choice => choice.value === this.next);
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
  margin: 0;
  padding: 0;
  border: none;

  :focus {
    outline: 0;
    box-shadow: 0 0 0 4px #b5c9fc;
  }

  div {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;

    label:first-child span {
      left: -1px;
    }

    label:last-child span {
      right: -1px;
    }
  }

  input[type="radio"] {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip: rect(0 0 0 0);
    clip-path: inset(100%);
    white-space: nowrap;

    &:checked + span {
      box-shadow: 0 0 0 1px var(--a-primary-dark-15);
      background-color: var(--a-primary-transparent-90);
      z-index: $z-index-default;
      color: var(--a-text-inverted);
    }
  }

  label {
    display: flex;
    align-items: center;

    &:hover input:not(:checked) + span {
      background-color: var(--a-base-9);
    }

    span {
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
  }
}
</style>

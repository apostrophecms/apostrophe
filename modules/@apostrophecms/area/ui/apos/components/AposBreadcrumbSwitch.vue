<template>
  <fieldset class="apos-breadcrumb-switch">
    <div>
      <label
        v-for="choice in choices"
        :key="choice.value"
      >
        <input
          :id="choice.value"
          v-model="store.data.value"
          :value="choice.value"
          type="radio"
          :name="name"
          @input="update"
        >
        <span>{{ choice.label }}</span>
      </label>
    </div>
  </fieldset>
</template>

<script>
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
    }
  },
  emits: [
    'update'
  ],
  data() {
    const name = `${this.name}:switch`;
    return {
      next: this.value || null,
      store: window.apos.widget.getOrSet(this.widgetId, name, this.value || null),
      namespace: name
    };
  },
  unmounted() {
    window.apos.widget.remove(this.widgetId, this.namespace);
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

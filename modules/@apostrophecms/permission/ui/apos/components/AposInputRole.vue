<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <select
          class="apos-input apos-input--select apos-input--role" :id="uid"
          @change="change($event.target.value)"
          :disabled="field.readOnly"
        >
          <option
            v-for="choice in choices" :key="JSON.stringify(choice.value)"
            :value="JSON.stringify(choice.value)"
            :selected="choice.value === value.data"
          >
            {{ choice.label }}
          </option>
        </select>
        <AposIndicator
          icon="menu-down-icon"
          class="apos-input-icon"
          :icon-size="20"
        />
      </div>
      <ul class="apos-input--permission-grid">
        <li
          v-for="type in types"
          :key="type.name"
        >
          <h4>
            {{ type.label }}
            <AposIndicator
              v-if="type.tooltip"
              icon="help-circle-icon"
              class="apos-field__help-tooltip__icon"
              :tooltip="type.tooltip"
              :icon-size="11"
              icon-color="var(--a-base-4)"
            />
          </h4>
          <ul>
            <li v-for="permission in type.permissions" :key="permission.name">
              <AposIndicator v-if="permission.value" icon="check-bold-icon" icon-color="var(--a-success)" />
              <AposIndicator v-else icon="alpha-x-icon" icon-color="var(--a-danger)" />
              &nbsp;{{ permission.label }}
            </li>
          </ul>
        </li>
      </ul>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRole',
  mixins: [ AposInputMixin ],
  props: {
    icon: {
      type: String,
      default: 'menu-down-icon'
    }
  },
  data() {
    return {
      next: (this.value.data == null) ? null : this.value.data,
      choices: [],
      types: []
    };
  },
  async mounted() {
    // Add an null option if there isn't one already
    if (!this.field.required && !this.field.choices.find(choice => {
      return choice.value === null;
    })) {
      this.choices.push({
        label: '',
        value: null
      });
    }
    this.choices = this.choices.concat(this.field.choices);
    this.$nextTick(() => {
      // this has to happen on nextTick to avoid emitting before schemaReady is
      // set in AposSchema
      if (this.field.required && (this.next == null) && (this.field.choices[0] != null)) {
        this.next = this.field.choices[0].value;
      }
    });
    this.types = await this.getTypes();
  },
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return 'required';
      }
      if (value && !this.field.choices.find(choice => choice.value === value)) {
        return 'invalid';
      }
      return false;
    },
    change(value) {
      // Allows expression of non-string values
      this.next = this.choices.find(choice => choice.value === JSON.parse(value)).value;
    },
    async getTypes() {
      return (await apos.http.get(`${apos.permission.action}/grid`, {})).types;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-input-icon {
  @include apos-transition();
}
ul {
  list-style: none;
  padding-inline-start: 0;
}

.apos-input--permission-grid > li {
  h4 {
    font-weight: bold;
  }
  li {
    padding: 0.5em 1em 0.25em;
    border-bottom: 1px solid var(--a-base-7);
  }
}
</style>

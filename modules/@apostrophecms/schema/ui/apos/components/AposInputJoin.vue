<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid" :items="items"
  >
    <template #body>
      <div class="apos-input-wrapper apos-input-join">
        <div class="apos-input-join__input-wrapper">
          <input
            class="apos-input apos-input--text apos-input--join"
            type="text"
            v-model="searchInput"
            :placeholder="placeholder"
            :disabled="status.disabled" :required="field.required"
            :id="uid"
            @input="input"
            @focus="handleFocus"
            @focusout="handleFocusOut"
            tabindex="0"
          >
          <AposButton
            :label="browseLabel"
            :modifiers="['small']"
            type="input"
          />
        </div>
        <AposSlatList @update="updated" :initial-items="items" />
        <AposSearchList
          :list="searchList"
          @select="selected"
          :selected-items="items"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin.js';

export default {
  name: 'AposInputJoin',
  mixins: [ AposInputMixin ],
  emits: [ 'input' ],
  data () {
    return {
      searchList: [],
      items: this.value.data,
      lastSearches: {},
      searchInput: '',
      originalDisabled: this.status.disabled
    };
  },
  computed: {
    pluralLabel() {
      return apos.modules[this.field.withType].pluralLabel;
    },
    placeholder() {
      return this.field.placeholder || `Search ${this.pluralLabel}`;
    },
    browseLabel() {
      return `Browse ${this.pluralLabel}`;
    }
  },
  mounted() {
    this.validate(this.items);
  },
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return { message: 'required' };
      }

      // if the original status was disabled, no validation should change that
      if (this.originalDisabled) {
        this.status.disabled = true;
        return;
      }

      if (this.field.max && this.field.max <= value.length) {
        this.searchInput = 'Limit reached!';
        this.status.disabled = true;
      } else {
        this.searchInput = '';
        this.status.disabled = false;
      }

      if (this.field.min && this.field.min > value.length) {
        return { message: `minimum of ${this.field.min} required` };
      }

      return false;
    },
    updated(items) {
      this.items = items;
      this.selected(items);
    },
    selected(items) {
      this.items = items;
      this.validateAndEmit();
    },
    async input () {
      if (this.searchInput) {
        if (!this.lastSearches[this.searchInput]) {
          const list = await apos.http.get(`${apos.modules[this.field.withType].action}?autocomplete=${this.searchInput}`, {
            busy: true
          });
          this.searchList = list.results;
          this.lastSearches[this.searchInput] = list.results;
        } else {
          this.searchList = this.lastSearches[this.searchInput];
        }
      } else {
        this.searchList = [];
      }
    },
    handleFocus() {
      if (this.next && this.lastSearches[this.next]) {
        this.searchList = this.lastSearches[this.next];
      }
    },
    handleFocusOut() {
      // hide search list when click outside the input
      // timeout to execute "@select" method before
      setTimeout(() => {
        this.searchList = [];
      }, 200);
    },
    validateAndEmit () {
      // override method from mixin to avoid standard behavior
      this.$emit('input', {
        data: this.items.map(item => item._id),
        error: this.validate(this.items)
      });
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-join__input-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }

  .apos-button {
    position: absolute;
    right: 7.5px;
  }
</style>

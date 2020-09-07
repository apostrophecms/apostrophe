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
            v-model="next" type="text"
            :placeholder="field.placeholder"
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
            @click="chooser=true"
          />
          <AposPiecesManager
            v-if="chooser"
            :moduleName="field.withType"
            :items="items"
            :max-items="field.max"
            :join="true"
            @updated="updated"
            @safe-close="chooser=false"
          />
        </div>
        <AposSlatList @update="updated" :initial-items="items" />
        <AposSearchList :list="searchList" @select="selected" :selected-items="items" />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin.js';

export default {
  name: 'AposInputJoin',
  mixins: [ AposInputMixin ],
  props: {
    listItems: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  data () {
    return {
      browseLabel: 'Browse ' + apos.modules[this.field.withType].pluralLabel,
      searchList: [],
      items: this.value.data || this.listItems,
      lastSearches: {},
      chooser: false
    };
  },
  mounted() {
    this.validateAndEmit();
  },
  watch: {
    next: function () {
      // override method from mixin to avoid standard behavior
    },
    value: function () {
      // override method from mixin to avoid standard behavior
    }
  },
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return { message: 'required' };
      }

      if (this.field.max && this.field.max <= value.length) {
        this.next = 'Limit reached!';
        this.status.disabled = true;
      } else {
        this.next = '';
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
      if (this.next.length) {
        if (!this.lastSearches[this.next]) {
          const list = await apos.http.get(`${apos.modules[this.field.withType].action}?autocomplete=${this.next}`, {
            busy: true
          });
          this.searchList = list.results;
          this.lastSearches[this.next] = list.results;
        } else {
          this.searchList = this.lastSearches[this.next];
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
        data: this.items,
        error: this.validate(this.items)
      });
    },
    watchValue () {
      // override method from mixin to avoid standard behavior
      this.error = this.value.error;
    },
    watchNext () {
      // override method from mixin to avoid standard behavior
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

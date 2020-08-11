<template>
<!-- TODO: handle joinByOne and joinByArray -->
<!-- TODO: handle mulitple joined types -->
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid"
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
  name: 'AposInputJoinByArray',
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
      items: this.listItems,
      lastSearches: {}
    };
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
        return 'required';
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
        data: this.items.map(item => item._id),
        error: this.validate(this.items)
      });
    },
    watchValue () {
      // override method from mixin to avoid standard behavior
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

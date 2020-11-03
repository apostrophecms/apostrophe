<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid" :items="next"
  >
    <template #body>
      <div class="apos-input-wrapper apos-input-relationship">
        <div class="apos-input-relationship__input-wrapper">
          <input
            class="apos-input apos-input--text apos-input--relationship"
            v-model="searchTerm" type="text"
            :placeholder="placeholder"
            :disabled="disabled" :required="field.required"
            :id="uid"
            @input="input"
            @focusout="handleFocusOut"
            tabindex="0"
          >
          <AposButton
            class="apos-input-relationship__button"
            :label="browseLabel"
            :modifiers="['small']"
            type="input"
            @click="choose"
          />
        </div>
        <AposSlatList
          class="apos-input-relationship__items"
          v-if="next.length"
          @input="updateSelected"
          @item-clicked="editRelationship"
          :value="next"
        />
        <AposSearchList
          :list="searchList"
          @select="updateSelected"
          :selected-items="next"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRelationship',
  mixins: [ AposInputMixin ],
  emits: [ 'input' ],
  data () {
    return {
      searchTerm: '',
      searchList: [],
      next: (this.value && Array.isArray(this.value.data))
        ? this.value.data : (this.field.def || []),
      disabled: false,
      searching: false,
      choosing: false,
      relationshipSchema: null
    };
  },
  computed: {
    pluralLabel() {
      return apos.modules[this.field.withType].pluralLabel;
    },
    // TODO get 'Search' server for better i18n
    placeholder() {
      return this.field.placeholder || `Search ${this.pluralLabel}`;
    },
    // TODO get 'Browse' for better i18n
    browseLabel() {
      return `Browse ${this.pluralLabel}`;
    },
    chooserComponent () {
      return apos.modules[this.field.withType].components.managerModal;
    }
  },
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return { message: 'required' };
      }
      if (this.field.max && this.field.max <= value.length) {
        this.searchTerm = 'Limit reached!';
        this.disabled = true;
      } else {
        this.searchTerm = '';
        this.disabled = false;
      }

      if (this.field.min && this.field.min > value.length) {
        return { message: `minimum of ${this.field.min} required` };
      }

      return false;
    },
    updateSelected(items) {
      this.next = items;
    },
    async input () {
      if (!this.searching) {
        if (this.searchTerm.length) {
          this.searching = true;
          const list = await apos.http.get(`${apos.modules[this.field.withType].action}?autocomplete=${this.searchTerm}`, {
            busy: true
          });

          // filter items already selected
          this.searchList = list.results.filter(item => {
            return !this.next.map(i => i._id).includes(item._id);
          });
          this.searching = false;
        } else {
          this.searchList = [];
        }
      }
    },
    handleFocusOut() {
      // hide search list when click outside the input
      // timeout to execute "@select" method before
      setTimeout(() => {
        this.searchList = [];
      }, 200);
    },
    watchValue () {
      this.error = this.value.error;
      // Ensure the internal state is an array.
      this.next = Array.isArray(this.value.data) ? this.value.data : [];
    },
    async choose () {
      const result = await apos.modal.execute(this.chooserComponent, {
        moduleName: this.field.withType,
        chosen: this.next,
        relationshipField: this.field
      });
      if (result) {
        this.updateSelected(result);
      }
    },
    async editRelationship (item) {
      const result = await apos.modal.execute('AposRelationshipEditor', {
        schema: this.field.schema,
        title: item.title,
        value: item._fields
      });
      if (result) {
        const index = this.next.findIndex(_item => _item._id === item._id);
        this.$set(this.next, index, {
          ...this.next[index],
          _fields: result
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-relationship__input-wrapper {
    position: relative;

    .apos-input-relationship__button {
      position: absolute;
      top: 6.5px;
      right: 5px;
      padding: ($input-padding - 5px) $input-padding;

      &:hover:not([disabled]),
      &:focus:not([disabled]) {
        transform: none;
      }
    }
  }

  .apos-input-relationship__items {
    max-width: $input-max-width;
    margin-top: 10px;
  }
</style>

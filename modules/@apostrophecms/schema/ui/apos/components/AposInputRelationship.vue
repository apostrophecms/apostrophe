<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid" :items="items"
  >
    <template #body>
      <div class="apos-input-wrapper apos-input-relationship">
        <div class="apos-input-relationship__input-wrapper">
          <input
            class="apos-input apos-input--text apos-input--relationship"
            v-model="next" type="text"
            :placeholder="placeholder"
            :disabled="status.disabled" :required="field.required"
            :id="uid"
            @input="input"
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
            :module-name="field.withType"
            :initially-selected-items="items"
            :field="field"
            :relationship="true"
            @updated="updated"
            @safe-close="chooser=false"
          />
        </div>
        <AposSlatList
          v-if="items.length"
          @update="updated"
          @item-clicked="openRelationshipEditor"
          :initial-items="items"
        />
        <AposSearchList
          :list="searchList"
          @select="selected"
          :selected-items="items"
        />
      </div>

      <AposRelationshipEditor
        v-if="relationshipSchema"
        :schema="relationshipSchema"
        :title="clickedItem.title"
        v-model="clickedItem._fields"
        @safe-close="relationshipSchema=null"
      />
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin.js';

export default {
  name: 'AposInputRelationship',
  mixins: [ AposInputMixin ],
  props: {
    listItems: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  emits: [ 'input' ],
  data () {
    return {
      searchList: [],
      items: this.value.data || this.listItems,
      lastSearches: {},
      originalDisabled: this.status.disabled,
      searching: false,
      chooser: false,
      relationshipSchema: null,
      clickedItem: null
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
    }
  },
  watch: {
    next: function () {
      // override method from mixin to avoid standard behavior
    },
    value: function () {
      // override method from mixin to avoid standard behavior
    }
  },
  mounted() {
    this.validateAndEmit();
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
      if (!this.searching) {
        if (this.next.length) {
          this.searching = true;
          const list = await apos.http.get(`${apos.modules[this.field.withType].action}?autocomplete=${this.next}`, {
            busy: true
          });

          // filter items already selected
          this.searchList = list.results.filter(item => {
            return !this.items.map(i => i._id).includes(item._id);
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
    },
    openRelationshipEditor (item) {
      this.relationshipSchema = this.field.schema;
      this.clickedItem = item;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-relationship__input-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }

  .apos-button {
    position: absolute;
    right: 7.5px;
  }
</style>

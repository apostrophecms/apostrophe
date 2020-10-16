<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid" :items="next"
  >
    <template #body>
      <div class="apos-input-wrapper apos-input-relationship">
        <div class="apos-input-relationship__input-wrapper">
          <input
            class="apos-input apos-input--text apos-input--relationship"
            v-model="searchTerm" type="text"
            :placeholder="placeholder"
            :disabled="status.disabled" :required="field.required"
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
            @click="choosing=true"
          />
        </div>
        <AposSlatList
          class="apos-input-relationship__items"
          v-if="next.length"
          @input="updateSelected"
          @item-clicked="openRelationshipEditor"
          :value="next"
        />
        <AposSearchList
          :list="searchList"
          @select="updateSelected"
          :selected-items="next"
        />
      </div>
    </template>
    <template #secondary>
      <portal to="modal-target">
        <component
          :is="chooserComponent"
          v-if="choosing"
          :module-name="field.withType"
          :chosen="next"
          :relationship-field="field"
          @chose="updateSelected"
          @safe-close="choosing=false"
        />
      </portal>
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
  emits: [ 'input' ],
  data () {
    return {
      searchTerm: '',
      searchList: [],
      next: (this.value && Array.isArray(this.value.data))
        ? this.value.data : (this.field.def || []),
      originalDisabled: this.status.disabled,
      searching: false,
      choosing: false,
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
    },
    chooserComponent () {
      return apos.modules[this.field.withType].components.managerModal;
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
        this.searchTerm = 'Limit reached!';
        this.status.disabled = true;
      } else {
        this.searchTerm = '';
        this.status.disabled = false;
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
    openRelationshipEditor (item) {
      this.relationshipSchema = this.field.schema;
      this.clickedItem = item;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-relationship__input-wrapper {
    position: relative;

    .apos-input-relationship__button {
      position: absolute;
      top: 5px;
      right: 5px;
      padding: ($input-padding - 5px) $input-padding;
      font-size: map-get($font-sizes, input);

      &:hover:not([disabled]),
      &:focus:not([disabled]) {
        transform: none;
      }
    }
  }

  .apos-input-relationship__items {
    max-width: 220px;
    margin-top: 10px;
  }
</style>

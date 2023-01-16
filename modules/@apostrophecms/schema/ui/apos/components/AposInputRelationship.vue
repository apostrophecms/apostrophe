<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid" :items="next"
    :display-options="displayOptions"
    :modifiers="modifiers"
  >
    <template #additional>
      <div
        v-if="minSize[0] || minSize[1]"
        class="apos-field__min-size"
      >
        {{
          $t('apostrophe:minSize', {
            width: minSize[0] || '???',
            height: minSize[1] || '???'
          })
        }}
      </div>
      <AposMinMaxCount
        :field="field"
        :value="next"
      />
    </template>
    <template #body>
      <div class="apos-input-wrapper apos-input-relationship">
        <div class="apos-input-relationship__input-wrapper">
          <input
            v-if="!modifiers.includes('no-search')"
            class="apos-input apos-input--text apos-input--relationship"
            v-model="searchTerm" type="text"
            :placeholder="$t(placeholder)"
            :disabled="field.readOnly || limitReached"
            :required="field.required"
            :id="uid"
            @input="input"
            @focusout="handleFocusOut"
            tabindex="0"
          >
          <AposButton
            class="apos-input-relationship__button"
            v-if="field.browse !== false"
            :disabled="field.readOnly || limitReached"
            :label="browseLabel"
            :modifiers="buttonModifiers"
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
          :disabled="field.readOnly"
          :has-relationship-schema="!!field.schema"
          :editor-label="field.editorLabel"
          :editor-icon="field.editorIcon"
        />
        <AposSearchList
          :list="searchList"
          @select="updateSelected"
          :selected-items="next"
          disabled-tooltip="apostrophe:publishBeforeUsingTooltip"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import { klona } from 'klona';

export default {
  name: 'AposInputRelationship',
  mixins: [ AposInputMixin ],
  emits: [ 'input' ],
  data () {
    const next = (this.value && Array.isArray(this.value.data))
      ? klona(this.value.data) : (klona(this.field.def) || []);

    // Remember relationship subfield values even if a document
    // is temporarily deselected, easing the user's pain if they
    // inadvertently deselect something for a moment
    const subfields = Object.fromEntries(
      (next || []).filter(doc => doc._fields)
        .map(doc => [ doc._id, doc._fields ])
    );

    return {
      searchTerm: '',
      searchList: [],
      next,
      subfields,
      disabled: false,
      searching: false,
      choosing: false,
      relationshipSchema: null
    };
  },
  computed: {
    limitReached() {
      return this.field.max === this.next.length;
    },
    pluralLabel() {
      return apos.modules[this.field.withType].pluralLabel;
    },
    // TODO get 'Search' server for better i18n
    placeholder() {
      return this.field.placeholder || {
        key: 'apostrophe:searchDocType',
        type: this.$t(this.pluralLabel)
      };
    },
    // TODO get 'Browse' for better i18n
    browseLabel() {
      return {
        key: 'apostrophe:browseDocType',
        type: this.$t(this.pluralLabel)
      };
    },
    chooserComponent () {
      return apos.modules[this.field.withType].components.managerModal;
    },
    disableUnpublished() {
      return apos.modules[this.field.withType].localized;
    },
    buttonModifiers() {
      const modifiers = [ 'small' ];
      if (this.modifiers.includes('no-search')) {
        modifiers.push('block');
      }
      return modifiers;
    },
    minSize() {
      const [ widgetOptions = {} ] = apos.area.widgetOptions;

      return widgetOptions.minSize || [];
    }
  },
  watch: {
    next(after, before) {
      for (const doc of before) {
        this.subfields[doc._id] = doc._fields;
      }
      for (const doc of after) {
        if (this.subfields[doc._id] && !Object.keys(doc._fields || {}).length) {
          doc._fields = this.subfields[doc._id];
        }
      }
    }
  },
  mounted () {
    this.checkLimit();
  },
  methods: {
    validate(value) {
      this.checkLimit();

      if (this.field.required && !value.length) {
        return { message: 'required' };
      }

      if (this.field.min && this.field.min > value.length) {
        return { message: `minimum of ${this.field.min} required` };
      }

      return false;
    },
    checkLimit() {
      if (this.limitReached) {
        this.searchTerm = 'Limit reached!';
      } else if (this.searchTerm === 'Limit reached!') {
        this.searchTerm = '';
      }

      this.disabled = !!this.limitReached;
    },
    updateSelected(items) {
      this.next = items;
    },
    async input () {
      if (this.searching) {
        return;
      }

      const trimmed = this.searchTerm.trim();
      if (!trimmed.length) {
        this.searchList = [];
        return;
      }

      const qs = {
        autocomplete: trimmed
      };

      if (this.field.withType === '@apostrophecms/image') {
        apos.bus.$emit('piece-relationship-query', qs);
      }

      this.searching = true;
      const list = await apos.http.get(
        apos.modules[this.field.withType].action,
        {
          busy: false,
          draft: true,
          qs
        }
      );
      // filter items already selected
      this.searchList = list.results
        .filter(item => !this.next.map(i => i._id).includes(item._id))
        .map(item => ({
          ...item,
          disabled: this.disableUnpublished && !item.lastPublishedAt
        }));

      this.searching = false;
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
        title: this.field.label || this.field.name,
        moduleName: this.field.withType,
        chosen: this.next,
        relationshipField: this.field
      });
      if (result) {
        this.updateSelected(result);
      }
    },
    async editRelationship (item) {
      const editor = this.field.editor || 'AposRelationshipEditor';

      const result = await apos.modal.execute(editor, {
        schema: this.field.schema,
        item,
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
    },
    getEditRelationshipLabel () {
      if (this.field.editor === 'AposImageRelationshipEditor') {
        return 'apostrophe:editImageAdjustments';
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
      top: 0;
      right: 0;
      padding: ($input-padding - 5px) $input-padding;

      &:hover:not([disabled]),
      &:focus:not([disabled]) {
        transform: none;
      }
    }
  }

  .apos-input-relationship__items {
    padding: relative;
    margin-top: $spacing-base;
  }

  .apos-field--small {
    .apos-input-relationship__button {
      padding: $spacing-half;
    }
  }
  .apos-field--no-search {
    .apos-input-relationship__button {
      position: relative;
      width: 100%;
      padding: 0;
    }
  }

  .apos-field__min-size {
    @include type-help;
    display: flex;
    flex-grow: 1;
    margin-bottom: $spacing-base;
    font-weight: var(--a-weight-bold);
  }
</style>

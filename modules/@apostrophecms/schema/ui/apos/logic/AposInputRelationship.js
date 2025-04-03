import { klona } from 'klona';
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import newInstance from 'apostrophe/modules/@apostrophecms/schema/lib/newInstance.js';

export default {
  name: 'AposInputRelationship',
  mixins: [ AposInputMixin ],
  emits: [ 'input' ],
  data () {
    const next = (this.modelValue && Array.isArray(this.modelValue.data))
      ? klona(this.modelValue.data)
      : (klona(this.field.def) || []);

    // Remember relationship subfield values even if a document
    // is temporarily deselected, easing the user's pain if they
    // inadvertently deselect something for a moment
    const subfields = Object.fromEntries(
      (next || []).filter(doc => doc._fields)
        .map(doc => [ doc._id, doc._fields ])
    );

    const suggestionFields = this.field.suggestionFields || apos.modules[this.field.withType]?.relationshipSuggestionFields;

    return {
      searchTerm: '',
      searchList: [],
      searchFocusIndex: null,
      searchHint: null,
      searchSuggestion: null,
      suggestionFields,
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
    suggestion() {
      return {
        disabled: true,
        tooltip: false,
        icon: false,
        classes: [ 'suggestion' ],
        title: this.$t(this.field.suggestionLabel),
        help: this.$t({
          key: this.field.suggestionHelp || 'apostrophe:relationshipSuggestionHelp',
          type: this.$t(this.pluralLabel)
        }),
        customFields: [ 'help' ]
      };
    },
    hint() {
      return {
        disabled: true,
        tooltip: false,
        icon: 'binoculars-icon',
        iconSize: 35,
        classes: [ 'hint' ],
        title: this.$t('apostrophe:relationshipSuggestionNoResults'),
        help: this.$t({
          key: this.field.browse
            ? 'apostrophe:relationshipSuggestionSearchAndBrowse'
            : 'apostrophe:relationshipSuggestionSearch',
          type: this.$t(this.pluralLabel)
        }),
        customFields: [ 'help' ]
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
    },
    duplicate () {
      return this.modelValue?.duplicate ? 'apos-input--error' : null;
    }
  },
  watch: {
    next(after, before) {
      for (const doc of before) {
        this.subfields[doc._id] = doc._fields;
      }
      for (const doc of after) {
        if (Object.keys(doc._fields || {}).length) {
          continue;
        }
        doc._fields = this.field.schema && (this.subfields[doc._id]
          ? this.subfields[doc._id]
          : this.getDefault());
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
    async search(qs) {
      const action = apos.modules[this.field.withType].action;
      const isPage = apos.modules['@apostrophecms/page'].validPageTypes
        .includes(this.field.withType);

      if (this.field.suggestionLimit) {
        qs.perPage = this.field.suggestionLimit;
      }
      if (this.field.suggestionSort) {
        qs.sort = this.field.suggestionSort;
      }
      if (this.field.withType === '@apostrophecms/image') {
        apos.bus.$emit('piece-relationship-query', qs);
      }
      if (isPage) {
        qs.type = this.field.withType;
      }

      this.searching = true;
      const list = await apos.http.get(action, {
        busy: false,
        draft: true,
        qs
      });

      const removeSelectedItem = item => !this.next.map(i => i._id).includes(item._id);
      const formatItems = item => ({
        ...item,
        disabled: this.disableUnpublished && !item.lastPublishedAt
      });

      const results = (list.results || [])
        .filter(removeSelectedItem)
        .map(formatItems);

      this.searchSuggestion = !qs.autocomplete ? this.suggestion : null;
      this.searchHint = (!qs.autocomplete || !results.length) ? this.hint : null;
      this.searchList = [ ...results ].filter(Boolean);
      this.searching = false;
    },
    async input () {
      if (this.searching) {
        return;
      }

      const trimmed = this.searchTerm.trim();
      const qs = trimmed.length
        ? {
          autocomplete: trimmed
        }
        : {};

      await this.search(qs);
      if (this.searchList.length) {
        // psuedo focus first element
        this.searchFocusIndex = 0;
      }
    },
    handleFocusOut() {
      // hide search list when click outside the input
      // timeout to execute "@select" method before
      setTimeout(() => {
        this.searchList = [];
      }, 300);
      this.searchFocusIndex = null;
    },
    handleKeydown(event) {
      switch (event.key) {
        case 'ArrowDown':
          if (this.searchFocusIndex + 1 < this.searchList.length) {
            this.searchFocusIndex++;
            return;
          }
          if (!this.searchList.length) {
            this.input();
          }
          break;
        case 'ArrowUp':
          if (this.searchFocusIndex - 1 >= 0) {
            return this.searchFocusIndex--;
          }
          if (!this.searchList.length) {
            this.input();
          }
          break;
        case 'Enter':
          this.updateSelected([ ...this.next, this.searchList[this.searchFocusIndex] ]);
          this.handleFocusOut();
          this.input();
          break;
        case 'Escape':
          this.handleFocusOut();
          event.stopPropagation();
          break;
      }
    },
    watchValue () {
      this.error = this.modelValue.error;
      // Ensure the internal state is an array.
      this.next = Array.isArray(this.modelValue.data) ? this.modelValue.data : [];
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
        'model-value': item._fields
      });

      if (result) {
        const index = this.next.findIndex(_item => _item._id === item._id);

        this.next = this.next.map((item, i) => {
          return i === index
            ? {
              ...item,
              _fields: result
            }
            : item;
        });
      }
    },
    getEditRelationshipLabel () {
      if (this.field.editor === 'AposImageRelationshipEditor') {
        return 'apostrophe:editImageAdjustments';
      }
    },
    getDefault() {
      return newInstance(this.field.schema);
    }
  }
};

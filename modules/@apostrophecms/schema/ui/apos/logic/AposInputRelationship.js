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
      return this.value.duplicate ? 'apos-input--error' : null;
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
      if (this.field.suggestionLimit) {
        qs.perPage = this.field.suggestionLimit;
      }
      if (this.field.suggestionSort) {
        qs.sort = this.field.suggestionSort;
      }
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

      const removeSelectedItem = item => !this.next.map(i => i._id).includes(item._id);
      const formatItems = item => ({
        ...item,
        disabled: this.disableUnpublished && !item.lastPublishedAt
      });

      const results = (list.results || [])
        .filter(removeSelectedItem)
        .map(formatItems);

      const suggestion = !qs.autocomplete && this.suggestion;
      const hint = (!qs.autocomplete || !results.length) && this.hint;

      this.searchList = [ suggestion, ...results, hint ].filter(Boolean);
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
    },
    getDefault() {
      const object = {};
      this.field.schema.forEach(field => {
        if (field.name.startsWith('_')) {
          return;
        }
        // Using `hasOwn` here, not simply checking if `field.def` is truthy
        // so that `false`, `null`, `''` or `0` are taken into account:
        const hasDefaultValue = Object.hasOwn(field, 'def');
        object[field.name] = hasDefaultValue
          ? klona(field.def)
          : null;
      });
      return object;
    }
  }
};

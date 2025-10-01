<template>
  <div
    class="apos-popover apos-layout-col-control__dialog"
  >
    <h2 class="apos-layout-col-control__header">
      Column Settings
    </h2>
    <AposSchema
      :key="widget._id"
      v-model="docFields"
      :schema="schema"
      :trigger-validation="triggerValidation"
      :modifiers="formModifiers"
      :generation="generation"
      @update:model-value="evaluateConditions()"
    />
    <footer class="apos-layout-col-control__footer">
      <AposButton
        type="primary"
        label="apostrophe:save"
        :modifiers="['small']"
        :disabled="docFields.hasErrors"
        @click="save"
      />
    </footer>
  </div>
</template>

<script>
import { klona } from 'klona';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';

export default {
  name: 'AposLayoutColControlDialog',
  mixins: [ AposEditorMixin ],
  props: {
    widget: {
      type: Object,
      default: function() {
        return {};
      }
    },
    widgetSchema: {
      type: Array,
      default: () => []
    }
  },
  emits: [ 'update', 'close' ],
  data() {
    return {
      triggerValidation: false,
      formModifiers: [ 'micro' ],
      conditionalFields: {},
      generation: 0
    };
  },
  computed: {
    schema() {
      const schema = [];
      const desktop = this.widgetSchema.find(s => s.name === 'desktop');
      const tablet = this.widgetSchema.find(s => s.name === 'tablet');
      const mobile = this.widgetSchema.find(s => s.name === 'mobile');

      tablet?.schema.filter(f => f.name === 'show').forEach(f => schema.push({
        ...f,
        name: 'showTablet'
      }));
      mobile?.schema.filter(f => f.name === 'show').forEach(f => schema.push({
        ...f,
        name: 'showMobile'
      }));
      desktop?.schema.filter(f => [ 'justify', 'align' ].includes(f.name))
        .forEach(f => schema.push(f));

      return schema;
    }
  },
  watch: {
    widget(newVal) {
      this.populateFields(newVal);
    }
  },
  async mounted() {
    this.populateFields(this.widget);
    window.addEventListener('keydown', this.keyboardHandler);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.keyboardHandler);
  },
  methods: {
    populateFields(widget) {
      this.docFields.data = {
        justify: widget.desktop?.justify,
        align: widget.desktop?.align,
        showTablet: widget.tablet?.show,
        showMobile: widget.mobile?.show
      };
      this.generation++;
    },
    close() {
      this.$emit('close');
    },
    save() {
      this.triggerValidation = true;
      this.$nextTick(() => {
        if (this.docFields.hasErrors) {
          return;
        }
        const doc = klona(this.widget);
        const {
          justify, align, showTablet, showMobile
        } = this.docFields.data;
        doc.desktop ??= {};
        doc.tablet ??= {};
        doc.mobile ??= {};
        doc.desktop.justify = justify;
        doc.desktop.align = align;
        doc.tablet.show = showTablet;
        doc.mobile.show = showMobile;

        this.$emit('update', doc);
        this.close();
      });
    },
    keyboardHandler(e) {
      if (e.key === 'Escape') {
        this.close();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-layout-col-control__dialog {
    width: 340px;
  }

  .apos-is-active {
    background-color: var(--a-base-7);
  }

  .apos-layout-col-control__header  {
    @include type-title;

    & {
      margin-top: 0;
      text-align: left;
      text-transform: none;
    }
  }

  .apos-layout-col-control__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-layout-col-control__footer .apos-button__wrapper {
    margin-left: 7.5px;
  }

  .apos-layout-col-control__remove {
    display: flex;
    justify-content: flex-end;
  }

  :deep(.apos-schema .apos-field.apos-field--micro) {
    margin-bottom: $spacing-base + $spacing-half;
  }
</style>

import { isEqual } from 'lodash';

export default {
  props: {
    // NOTE: docId is always null, investigate if needed
    docId: String,
    type: String,
    areaFieldId: String,
    modelValue: Object,
    mode: {
      type: String,
      default: 'draft'
    },
    meta: {
      type: Object,
      default() {
        return {};
      }
    },
    // Ignored for server side rendering
    areaField: Object,
    followingValues: Object,
    // Fix missing prop rendered as `[object Object]` attribute in the DOM
    options: Object,
    rendering: {
      type: Object,
      default() {
        return null;
      }
    }
  },
  watch: {
    modelValue: {
      handler(newVal, oldVal) {
        let needsFullRender;
        if (this.moduleOptions.preview) {
          needsFullRender = false;
          for (const field of this.moduleOptions.schema) {
            if (!isEqual(newVal[field.name], oldVal[field.name])) {
              if (field.boxRule || field.boxClass) {
                continue;
              }
              needsFullRender = true;
            }
          }
        }
        if (needsFullRender) {
          this.renderContent();
        } else {
          this.renderBoxCss();
        }
      }
    }
  },
  data() {
    return {
      rendered: '...'
    };
  },
  mounted() {
    this.renderContent();
  },
  computed: {
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.type]];
    }
  },
  methods: {
    async renderContent() {
      apos.bus.$emit('widget-rendering');
      const parameters = {
        _docId: this.docId,
        widget: this.modelValue,
        areaFieldId: this.areaFieldId,
        type: this.type
      };
      try {
        if (this.rendering && (isEqual(this.rendering.parameters, parameters))) {
          this.rendered = this.rendering.html;
        } else {
          // Don't use a placeholder here, it causes flickering in live preview mode.
          // It is better to display the old until we display the new,
          // we have "busy" for clarity
          this.rendered = await apos.http.post(`${apos.area.action}/render-widget?aposEdit=1&aposMode=${this.mode}`, {
            busy: true,
            body: parameters
          });
        }
        // Wait for reactivity to render v-html so that markup is
        // in the DOM before hinting that it might be time to prepare
        // sub-area editors and run players
        setTimeout(function() {
          apos.bus.$emit('widget-rendered');
        }, 0);
      } catch (e) {
        this.rendered = '<p>Unable to render this widget.</p>';
        console.error('Unable to render widget. Possibly the schema has been changed and the existing widget does not pass validation.', e);
      }
    },
    renderBoxCss() {
      const box = this.$refs.rendered.querySelector('[data-apos-widget-box]');
      const classes = [ 'apos-widget-box' ];
      const rules = [];
      for (const field of this.moduleOptions.fields) {
        if (field.if) {
          // Box fields must be top level and support one level of basic "if" conditions
          if (Object.entries(field.if).some(([ key, val ]) => this.modelValue[key] !== val)) {
            continue;
          }
        }
        const value = this.modelValue[field.name];
        if (field.cssRule) {
          rules.push(field.cssRule.replaceAll('VALUE', value));
        }
        if (field.cssClass) {
          classes.push(field.cssClass.replaceAll('VALUE', value));
        }
      }
      box.attr('class', classes.join(' '));
      box.attr('style', rules.join(' '));
    },
    getClasses() {
      const { placeholderClass } = this.moduleOptions;

      if (!placeholderClass) {
        return {};
      }

      return {
        [placeholderClass]: this.modelValue.aposPlaceholder === true
      };
    }
  }
};

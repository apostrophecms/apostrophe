import props from '../composables/AposWidgetProps.js';
import {
  _renderContent, _emitWidgetRendered, _getClasses
} from '../composables/AposWidget.js';

export default {
  props,
  data() {
    return {
      rendered: '...'
    };
  },
  watch: {
    modelValue: {
      handler(widget) {
        if (widget.type !== '@apostrophecms/layout-column') {
          this.renderContent();
        }
      }
    }
  },
  computed: {
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.type]];
    }
  },
  mounted() {
    this.renderContent();
  },
  methods: {
    getClasses() {
      return _getClasses(this.modelValue, this.moduleOptions);
    },
    async renderContent() {
      const result = await _renderContent(this.$props);
      if (Object.hasOwn(result, 'data')) {
        this.rendered = result.data;
      }
      if (!result.error) {
        this.$nextTick(() => {
          _emitWidgetRendered(this.modelValue.aposLivePreview);
        });
      }
    }
  }
};

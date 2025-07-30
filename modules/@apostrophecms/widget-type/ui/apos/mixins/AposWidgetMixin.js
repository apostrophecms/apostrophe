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
      handler() {
        this.renderContent();
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
      this.rendered = await _renderContent(this.$props);
      this.$nextTick(() => {
        _emitWidgetRendered(this.$props);
      });
    }
  }
};

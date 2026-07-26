import props from '../composables/AposWidgetProps.js';
import {
  _renderContent, _emitWidgetRendered, _getClasses
} from '../composables/AposWidget.js';

export default {
  props,
  data() {
    return {
      rendered: '...',
      renderId: 0,
      lastShownRenderId: -1,
      active: false
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
    // This method is fire-and-forget. It uses async internally to
    // debounce simultaneous async requests
    async renderContent() {
      this.renderId++;
      // Because it can change in a later invocation during
      // the network request
      const renderId = this.renderId;
      if (this.active) {
        // Wait for the current render request to finish
        await this.active;
        if (renderId < this.renderId) {
          // Skip this render request, a newer one has shown up
          // in the meantime
          return;
        }
      }
      // We didn't get skipped and it's our turn now
      this.active = (async () => {
        const result = await _renderContent(this.$props);
        this.active = false;
        if (renderId < this.lastShownRenderId) {
          // The network can return renders out of order,
          // never display something more stale than the
          // last thing displayed
          return;
        }
        this.lastShownRenderId = renderId;
        if (Object.hasOwn(result, 'data')) {
          this.rendered = result.data;
        }
        if (!result.error) {
          this.$nextTick(() => {
            _emitWidgetRendered(this.modelValue.aposLivePreview, { el: this.$el });
          });
        }
      })();
    }
  }
};

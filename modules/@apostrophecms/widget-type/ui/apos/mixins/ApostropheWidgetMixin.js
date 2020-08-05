export default {
  props: {
    docId: String,
    type: String,
    areaFieldId: String,
    value: Object
  },
  watch: {
    value: {
      deep: true,
      handler() {
        this.renderContent();
      }
    }
  },
  data() {
    return {
      rendered: '...'
    };
  },
  mounted: function() {
    this.renderContent();
  },
  computed: {
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.type]];
    }
  },
  methods: {
    async renderContent() {
      this.rendered = await apos.http.post(`${apos.area.action}/render-widget`, {
        busy: true,
        body: {
          _docId: this.docId,
          widget: this.value,
          areaFieldId: this.areaFieldId,
          type: this.type
        }
      });
      // Wait for reactivity to populate v-html so the
      // ApostropheAreas manager can spot any new area divs
      setImmediate(function() {
        apos.bus.$emit('widget-rendered');
      });
    },
    clicked(e) {
      // If you do not want a particular click to swap to the edit view
      // for your widget, you should make sure it does not bubble
      if (this.moduleOptions.contextual) {
        e.stopPropagation();
        e.preventDefault();
        this.$emit('edit');
      }
    }
  }
};

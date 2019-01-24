import axios from 'axios';
import cookies from 'js-cookie';

export default {
  props: {
    type: String,
    options: Object,
    value: Object,
    docId: String
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
      return apos.modules[apos.areas.widgetManagers[this.type]];
    }
  },
  methods: {
    async renderContent() {
      const response = await axios.create({
        headers: {
          'X-XSRF-TOKEN': cookies.get(window.apos.csrfCookieName)
        }
      }).post(
        apos.areas.action + '/render-widget',
        {
          widget: this.value,
          options: this.options,
          type: this.type,
          docId: this.docId
        }
      );
      this.rendered = response.data;
      // Wait for reactivity to populate v-html so the
      // ApostropheAreas manager can spot any new area divs
      setImmediate(function() {
        apos.bus.$emit('widgetChanged');
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

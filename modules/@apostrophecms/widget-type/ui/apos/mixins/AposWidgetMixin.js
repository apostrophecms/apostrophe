import { isEqual } from 'lodash';

export default {
  props: {
    docId: String,
    type: String,
    areaFieldId: String,
    value: Object,
    rendering: {
      type: Object,
      default() {
        return null;
      }
    }
  },
  watch: {
    value: {
      handler() {
        this.renderContent();
      }
    }
  },
  data() {
    return {
      rendered: '...',
      playerOpts: null
    };
  },
  mounted() {
    this.renderContent();
    this.playerOpts = apos.util.widgetPlayers[this.type] || null;
  },
  updated () {
    this.runPlayer();
  },
  computed: {
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.type]];
    }
  },
  methods: {
    async renderContent() {
      const parameters = {
        _docId: this.docId,
        widget: this.value,
        areaFieldId: this.areaFieldId,
        type: this.type
      };
      try {
        if (this.rendering && (isEqual(this.rendering.parameters, parameters))) {
          this.rendered = this.rendering.html;
          this.runPlayer();
        } else {
          this.rendered = '...';
          this.rendered = await apos.http.post(`${apos.area.action}/render-widget?apos-edit=1&apos-mode=draft`, {
            busy: true,
            body: parameters
          });
        }
        // Wait for reactivity to populate v-html so the
        // AposAreas manager can spot any new area divs.
        // This will also run the player
        setTimeout(function() {
          apos.bus.$emit('widget-rendered');
        }, 0);
      } catch (e) {
        this.rendered = '<p>Unable to render this widget.</p>';
        console.error('Unable to render widget. Possibly the schema has been changed and the existing widget does not pass validation.', e);
      }
    },
    runPlayer() {
      if (!this.playerOpts) {
        return;
      }
      const el = this.$el.querySelector(this.playerOpts.selector);
      if (el && this.playerOpts.player) {
        this.playerOpts.player(el);
      }
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

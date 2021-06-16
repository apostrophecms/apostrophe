// Provide basic bridging functionality between tabs
// and the modal body.

export default {
  data() {
    return {
      currentTab: null
    };
  },
  mounted() {
    this.currentTab = this.tabs[0] ? this.tabs[0].name : null;
  },
  methods: {
    switchPane(id) {
      this.currentTab = id;
    }
  }
};

import cuid from 'cuid';

// Provide basic bridging functionality between tabs
// and the modal body.

export default {
  data() {
    return {
      tabKey: cuid(),
      currentTab: null
    };
  },
  computed: {
    groups() {
      const groupSet = {};

      this.schema.forEach(field => {
        if (
          this.filterOutParkedFields &&
          !this.filterOutParkedFields([ field.name ]).length
        ) {
          return;
        }
        if (field.group && !groupSet[field.group.name]) {
          groupSet[field.group.name] = {
            label: field.group.label,
            fields: [ field.name ],
            schema: [ field ]
          };
        } else if (field.group) {
          groupSet[field.group.name].fields.push(field.name);
          groupSet[field.group.name].schema.push(field);
        }
      });
      if (!groupSet.utility) {
        groupSet.utility = {
          label: 'apostrophe:utility',
          fields: [],
          schema: []
        };
      }

      return groupSet;
    },
    tabs() {
      const tabs = [];
      for (const key in this.groups) {
        if (key !== 'utility') {
          tabs.push({
            name: key,
            label: this.groups[key].label
          });
        }
      };

      return tabs;
    }
  },

  watch: {
    tabs() {
      if ((!this.currentTab) || (!this.tabs.find(tab => tab.name === this.currentTab))) {
        this.currentTab = this.tabs[0] && this.tabs[0].name;
      }
    }
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

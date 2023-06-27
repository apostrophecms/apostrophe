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
          const conditionalFields = this.conditionalFields('other');
          const fields = this.groups[key].fields;
          tabs.push({
            name: key,
            label: this.groups[key].label,
            fields,
            isVisible: fields.filter(field => conditionalFields[field] !== false).length > 0
          });
        }
      }

      return tabs;
    }
  },

  watch: {
    tabs() {
      if ((!this.currentTab) || (!this.tabs.find(tab => tab.isVisible === true && tab.name === this.currentTab))) {
        const firstVisibleTab = this.tabs.find(tab => tab.isVisible === true);
        this.currentTab = firstVisibleTab && firstVisibleTab.name;
      }
    }
  },

  mounted() {
    const firstVisibleTab = this.tabs.find(tab => tab.isVisible === true);
    this.currentTab = (firstVisibleTab && firstVisibleTab.name) || null;
  },
  methods: {
    switchPane(id) {
      this.currentTab = id;
    }
  }
};

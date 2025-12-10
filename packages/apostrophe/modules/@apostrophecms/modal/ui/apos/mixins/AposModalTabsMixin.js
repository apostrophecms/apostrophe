import { createId } from '@paralleldrive/cuid2';

// Provide basic bridging functionality between tabs
// and the modal body.

export default {
  data() {
    return {
      tabKey: createId(),
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
          // AposRelationshipEditor does not implement AposEditorMixin with the
          // function getConditionalFields
          const fields = this.groups[key].fields;
          tabs.push({
            name: key,
            label: this.groups[key].label,
            fields,
            isVisible: this.conditionalFields?.if
              ? fields.some(field => this.conditionalFields.if[field] !== false)
              : true
          });
        }
      }

      return tabs;
    },
    firstVisibleTabName() {
      const { name = null } = this.tabs
        .find(tab => tab.isVisible === true) || this.tabs[0] || {};

      return name;
    }
  },

  watch: {
    tabs() {
      if (
        !this.currentTab ||
        !this.tabs.some(tab => tab.isVisible === true && tab.name === this.currentTab)
      ) {
        this.currentTab = this.firstVisibleTabName;
      }
    }
  },

  mounted() {
    this.currentTab = this.firstVisibleTabName;
  },
  methods: {
    switchPane(id) {
      this.currentTab = id;
    }
  }
};

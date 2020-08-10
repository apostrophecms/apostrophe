// TODO: Reconcile the overlap in this mixin between the pages and pieces
// managers. Does it need to be a mixin? This may be resolved when switching to
// Vue 3 using the composition API. - AB
export default {
  data() {
    return {
      icons: {},
      checkboxes: {},
      checked: []
    };
  },
  computed: {
    headers() {
      return this.options.columns ? this.options.columns : [];
    },
    selectAllValue() {
      return this.checked.length > 0 ? { data: ['checked'] } : { data: [] };
    },
    selectAllChoice() {
      const checkLen = this.checked.length;
      const rowLen = this.rows.length;

      return checkLen > 0 && checkLen !== rowLen ? {
        value: 'checked',
        indeterminate: true
      } : {
        value: 'checked'
      };
    }
  },
  watch: {
    rows: function(newValue) {
      if (newValue.length) {
        this.generateUi();
      }
    }
  },
  methods: {
    toggleRowCheck(event, id) {
      if (this.checked.includes(id)) {
        this.checked = this.checked.filter(item => item !== id);
        this.checkboxes[id].value.data = [];
      } else {
        this.checked.push(id);
        this.checkboxes[id].value.data = ['checked'];
      }
      console.info(this.checkboxes[id].value.data);
    },
    selectAll(event) {
      if (!this.checked.length) {
        this.rows.forEach((row) => {
          this.toggleRowCheck('checked', row._id);
        });
        return;
      }

      if (this.checked.length <= this.rows.length) {
        this.checked.forEach((id) => {
          this.toggleRowCheck('checked', id);
        });
      }
    },

    iconSize(header) {
      if (header.icon) {
        if (header.icon === 'Circle') {
          return 8;
        } else {
          return 10;
        }
      }
    },

    getEl(header) {
      if (header.action) {
        return 'button';
      } else {
        return 'span';
      }
    },

    sort(action) {
      this.$emit('sort', action);
    },
    generateUi () {
      this.generateIcons();
      this.generateCheckboxes();
    },
    generateIcons () {
      // fetch all icons used in table headers
      const icons = {};
      this.headers.forEach(h => {
        if (h.icon) {
          icons[h.icon] = `${h.icon.toLowerCase()}-icon`;
        }
      });
      this.icons = icons;
      // prep row checkbox fields
    },
    generateCheckboxes () {
      const checkboxes = {};
      this.rows.forEach((row) => {
        checkboxes[row._id] = {
          status: {},
          value: {
            data: []
          },
          choice: { value: row._id },
          field: {
            name: row._id,
            type: 'checkbox',
            hideLabel: true,
            label: `Toggle selection of ${row.title}`
          }
        };
      });
      this.checkboxes = checkboxes;
    }
  }
};

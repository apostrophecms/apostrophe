export default {
  title: 'Version History'
};

export const versionHistory = () => {
  return {
    methods: {
      toggleActive: function () {
        this.active = !this.active;
      },
      finishExit: function () {
        this.active = false;
      }
    },
    data () {
      return {
        active: true,
        doc: {
          // This _id value is used in the mock version history.
          _id: 'ckdhjwh1c00071r9kfs5ddeem',
          title: 'Home'
        }
      };
    },
    template: `
      <div>
        <button type="button" class="apos-button" @click="toggleActive">
          Activate modal
        </button>
        <AposDocVersions
          v-if="active" @safe-close="finishExit" :doc="doc"
        />
      </div>
    `
  };
};

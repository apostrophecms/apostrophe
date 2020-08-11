export default {
  title: 'Doc History'
};

export const docHistory = () => {
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
        <AposDocHistory
          v-if="active" @safe-close="finishExit" :doc="doc"
        />
      </div>
    `
  };
};

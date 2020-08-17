export default {
  title: 'Pages Manager'
};

export const pagesManager = () => {
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
        active: true
      };
    },
    template: `
      <div>
        <button type="button" class="apos-button" @click="toggleActive">
          Activate modal
        </button>
        <AposPagesManager
          v-if="active" @safe-close="finishExit"
        />
      </div>
    `
  };
};

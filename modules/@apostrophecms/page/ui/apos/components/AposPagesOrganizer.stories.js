export default {
  title: 'Pages Organize'
};

export const pagesOrganize = () => {
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
        <AposPagesOrganizer
          v-if="active" @safe-close="finishExit"
        />
      </div>
    `
  };
};

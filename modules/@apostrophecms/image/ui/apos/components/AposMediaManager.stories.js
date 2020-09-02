import AposMediaManager from './AposMediaManager.vue';

export default {
  title: 'Media Manager'
};

export const mediaManager = () => {
  return {
    components: {
      AposMediaManager
    },
    methods: {
      handleTrash(selected) {
        console.info(`trash ${JSON.stringify(selected)}`);
      },
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
      <AposMediaManager
        v-if="active"
<<<<<<< HEAD
        moduleName="@apostrophecms/image"
=======
        moduleName="image"
>>>>>>> 3.0
        @trash="handleTrash"
        @safe-close="finishExit"
      />
    </div>
    `
  };
};

import { mapActions } from 'pinia';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export default {
  computed: {
    directionClass() {
      return this.getAdminFieldDirectionClass(this.field?.direction);
    }
  },
  methods: {
    ...mapActions(useModalStore, [ 'getAdminFieldDirectionClass' ])
  }
};

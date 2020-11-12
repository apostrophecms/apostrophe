import { storiesOf } from '@storybook/vue';

import AposAvatar from './AposAvatar.vue';

const user = {
  firstName: 'Chris',
  lastName: 'Kringle',
  _id: 'np123'
};

storiesOf('Avatars', module)
  .add('Avatar (single src file)', () => ({
    components: { AposAvatar },
    data() {
      return {
        user
      };
    },
    template: '<AposAvatar :user="user" alt="Sociable weaver bird"/>'
  }));

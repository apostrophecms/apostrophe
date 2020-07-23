import { storiesOf } from '@storybook/vue';

import AposAvatar from './AposAvatar.vue';

storiesOf('Avatars', module)
  .add('Avatar (single src file)', () => ({
    components: { AposAvatar },
    template: '<AposAvatar src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Sociable_weaver_%28Philetairus_socius%29.jpg/600px-Sociable_weaver_%28Philetairus_socius%29.jpg" alt="Sociable weaver bird"/>'
  }))
  .add('Avatar (single src file, large)', () => ({
    components: { AposAvatar },
    template: '<AposAvatar src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Sociable_weaver_%28Philetairus_socius%29.jpg/600px-Sociable_weaver_%28Philetairus_socius%29.jpg" alt="Sociable weaver bird" size="120px"/>'
  }));

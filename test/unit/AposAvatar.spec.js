/* NOTE:
   This component does not show up in the coverage report
   because it doesn't have a data property. But it is still testable..

   More on why it's missing from the coverage report here:
   https://github.com/vuejs/vue-jest/issues/32#issuecomment-361602308
*/

import { shallowMount } from '@vue/test-utils';
import AposAvatar from '../../lib/modules/@apostrophecms/ui/src/apos/components/AposAvatar';

describe('AposAvatar.vue', () => {
  it('renders props when passed', () => {
    const propsData = {
      alt: 'My Avatar',
      src: '/images/me.jpg'
    };

    const wrapper = shallowMount(AposAvatar, {
      propsData
    });

    expect(wrapper.attributes().alt).toMatch(propsData.alt);
    expect(wrapper.attributes().src).toMatch(propsData.src);
    expect(wrapper.element.style.width).toMatch('');
  });
});

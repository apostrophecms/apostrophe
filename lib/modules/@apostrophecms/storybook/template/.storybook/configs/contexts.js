import Theme from './components/Theme.vue';
export const contexts = [
  {
    icon: 'mirror',
    title: 'Themes',
    components: [Theme],
    params: [
      {
        name: 'Dark Theme',
        props: { theme: 'apos-theme-dark' }
      },
      {
        name: 'Dark Theme, in Rail',
        props: { theme: 'apos-theme-dark sb-context-rail' }
      },
      {
        name: 'Light Theme',
        props: { theme: 'apos-theme-light' },
        default: true
      },
      {
        name: 'Light Theme, in Rail',
        props: { theme: 'apos-theme-light sb-context-rail' }
      }
    ],
    options: {
      deep: true, // pass the `props` deeply into all wrapping components
      disable: false, // disable this contextual environment completely
      cancelable: false // allow this contextual environment to be opt-out optionally in toolbar
    }
  },
  {
    icon: 'mirror',
    title: 'Primary Color',
    components: [Theme],
    params: [
      {
        name: 'Purple',
        props: { theme: 'apos-theme--primary-purple' },
        default: true
      },
      {
        name: 'Blue',
        props: { theme: 'apos-theme--primary-blue' }
      },
      {
        name: 'Orange',
        props: { theme: 'apos-theme--primary-orange' }
      },
      {
        name: 'Light Blue',
        props: { theme: 'apos-theme--primary-light-blue' }
      },
      {
        name: 'Sun',
        props: { theme: 'apos-theme--primary-sun' }
      },
      {
        name: 'Money',
        props: { theme: 'apos-theme--primary-money' }
      },
      {
        name: 'Pink',
        props: { theme: 'apos-theme--primary-pink' }
      }
    ],
    options: {
      deep: true, // pass the `props` deeply into all wrapping components
      disable: false, // disable this contextual environment completely
      cancelable: false // allow this contextual environment to be opt-out optionally in toolbar
    }
  }
];

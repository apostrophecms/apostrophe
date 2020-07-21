import AposTagApply from './AposTagApply.vue';

const data = getData();

export default {
  title: 'Tag Apply Tag Menu'
};

export const tagApplyTagMenu = () => ({
  components: {
    AposTagApply
  },
  methods: {
    log(value) {
      // Do extra JSON work since `value` will come through with `getter` and
      // `setter` functions.
      console.table(JSON.parse(JSON.stringify(value)));
    }
  },
  data() {
    return {
      tags: data.tags,
      applyTo: data.applyTo
    };
  },
  template: '<AposTagApply v-on:add-tag="log" :tags="tags" :applyTo="applyTo" v-on:update="log" />'
});

function getData() {
  return {
    applyTo: [
      'reduce-earning-muscle-wonder-deciding',
      'lose-boyd-inside-tries-descartes',
      'oriented-smear-bodies-hedge-vermont'
    ],
    tags: [
      {
        label: 'Nature',
        slug: 'nature',
        match: [
          'reduce-earning-muscle-wonder-deciding',
          'lose-boyd-inside-tries-descartes',
          'oriented-smear-bodies-hedge-vermont'
        ]
      },
      {
        label: 'Nurture',
        slug: 'nurture',
        match: [
          'reduce-earning-muscle-wonder-deciding',
          'lose-boyd-inside-tries-descartes',
          'oriented-smear-bodies-hedge-vermont'
        ]
      },
      {
        label: 'Natural',
        slug: 'natural',
        match: [
          'reduce-earning-muscle-wonder-deciding',
          'oriented-smear-bodies-hedge-vermont'
        ]
      },
      {
        label: 'Niceness',
        slug: 'niceness'
      },
      {
        label: 'Nastiness',
        slug: 'nastiness'
      },
      {
        label: 'Nuance',
        slug: 'nuance'
      },
      {
        label: 'Nightly',
        slug: 'nightly'
      },
      {
        label: 'Napkins',
        slug: 'napkins'
      },
      {
        label: 'Neurons',
        slug: 'neurons'
      },
      {
        label: 'Neurosis',
        slug: 'neurosis'
      },
      {
        label: 'New Wave',
        slug: 'new-wave'
      },
      {
        label: 'Nespresso',
        slug: 'nespresso'
      }
    ]
  };
}

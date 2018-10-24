<template>
  <div class="apos-pieces-list">
    <table>
      <thead>
        <tr>
          <th v-for="column in options.columns">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="piece in pieces">
          <td v-for="column in options.columns">{{ piece[column.name] }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'ApostrophePiecesList',
  props: {
    moduleName: String,
    pieces: Array
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  },
  methods: {
    // Something relating to manipulating the selection no doubt
  }
};
</script>

<template>
  <div class="apos-combo">
    <ul class="apos-input-wrapper apos-combo__select">
      <li
        class="apos-combo__selected"
        v-for="selected in value.data"
        :key="selected"
      >
        {{ selected }}
        <span class="apos-combo__unselect">
          x
        </span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'AposCombo',
  props: {
    choices: {
      type: Array,
      required: true
    },
    field: {
      type: Object,
      required: true
    },
    value: {
      type: Object,
      required: true
    }
  },
  mounted() {
    console.log('this.field', this.field);
  }
};
</script>

<style lang="scss" scoped>
.apos-combo {

}

/* .apos-combo__select { */
/*   background-color: var(--a-base-9); */
/*   border: 1px solid var(--a-base-2); */
/**/
/* } */

.apos-combo__selected {

}

</style>

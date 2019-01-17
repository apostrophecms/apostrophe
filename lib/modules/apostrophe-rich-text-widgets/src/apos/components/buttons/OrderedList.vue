<template>
  <button :class="{ 'is-active': isActive.ordered_list() }" @click="commands.ordered_list">
    Ordered List
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

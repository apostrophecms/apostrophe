<template>
  <button @click="commands.undo">
    Undo
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

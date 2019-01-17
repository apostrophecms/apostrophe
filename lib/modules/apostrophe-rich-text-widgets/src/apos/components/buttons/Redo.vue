<template>
  <button @click="commands.redo">
    Redo
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

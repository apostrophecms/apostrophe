<template>
  <button :class="{ 'is-active': isActive.bold() }" @click="commands.bold">
    Bold
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

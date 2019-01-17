<template>
  <button :class="{ 'is-active': isActive.italic() }" @click="commands.italic">
    Italic
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

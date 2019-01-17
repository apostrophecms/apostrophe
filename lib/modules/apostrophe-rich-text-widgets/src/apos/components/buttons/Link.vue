<template>
  <button :class="" @click="">
    Link
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

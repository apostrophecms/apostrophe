<template>
  <button :class="" @click="">
    Heading
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

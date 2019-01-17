<template>
  <button :class="{ 'is-active': isActive.bullet_list() }" @click="commands.bullet_list">
    Unordered List
  </button>
</template>

<script>
  export default {
    props: ['commands', 'isActive']
  }
</script>

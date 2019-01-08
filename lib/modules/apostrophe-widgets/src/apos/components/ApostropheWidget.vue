<template>
  <div @click="clicked" v-html="rendered"></div>
</template>

<script>

export default {
  name: 'ApostropheWidget',
  mixins: [ apos.mixins.ApostropheWidget ]
}

</script>
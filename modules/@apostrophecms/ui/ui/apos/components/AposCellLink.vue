<template>
  <a
    :href="item[header.name]"
    @click.stop
  >
    <link-icon :size="14" />
  </a>
</template>

<script>
export default {
  name: 'AposCellLink',
  props: {
    item: {
      type: Object,
      required: true
    },
    header: {
      type: Object,
      required: true
    }
  }
};
</script>

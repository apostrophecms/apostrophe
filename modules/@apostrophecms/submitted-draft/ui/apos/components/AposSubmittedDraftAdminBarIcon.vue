<template>
  <arrow-expand-right-icon
    v-if="count > 0"
    :size="size"
    class="apos-indicator__icon"
    :fill-color="fillColor"
  />
</template>
<script>
export default {
  name: 'AposSubmittedDraftAdminBarIcon',
  props: {
    icon: {
      type: String,
      required: true
    },
    size: {
      type: String,
      required: true,
      default() {
        return null;
      }
    },
    fillColor: {
      type: String,
      required: false,
      default() {
        return null;
      }
    }
  },
  data() {
    return {
      count: 0
    };
  },
  mounted() {
    this.updateCount();
  },
  destroyed() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  },
  methods: {
    async updateCount() {
      this.count = (await apos.http.get(apos.modules['@apostrophecms/submitted-draft'].action, {
        qs: {
          count: 1,
          'apos-mode': 'draft'
        }
      })).count;
      // Not declared in data() because it is not reactive
      this.timeout = setTimeout(this.updateCount, 10000);
    }
  }
};
</script>

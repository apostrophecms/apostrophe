<template>
  <span v-if="count > 0" class="apos-submitted-draft-admin-bar-container">
    <AposIndicator
      icon="tray-full-icon"
      class="apos-input-icon"
      :icon-size="size"
    />
    <span v-if="canPublish" class="apos-submitted-draft-admin-bar-counter">
      {{ count }}
    </span>
  </span>
</template>
<script>
export default {
  name: 'AposSubmittedDraftAdminBarIcon',
  props: {
    size: {
      type: Number,
      required: true,
      default() {
        return null;
      }
    },
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
  computed: {
    canPublish() {
      return window.apos.modules['@apostrophecms/submitted-draft'].canPublish;
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

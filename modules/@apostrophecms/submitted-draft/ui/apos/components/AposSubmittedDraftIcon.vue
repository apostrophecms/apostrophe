<template>
  <AposButton
    icon="tray-full-icon"
    type="subtle" :modifiers="['small', 'no-motion']"
    @click="open"
    :disabled="count <= 0"
    :tooltip="tooltip"
    :icon-only="true"
  >
    <template #label>
      <span v-if="canPublish && count > 0" class="apos-submitted-drafts__counter">
        {{ count }}
      </span>
    </template>
  </AposButton>
</template>
<script>
export default {
  name: 'AposSubmittedDraftIcon',
  data() {
    return {
      count: 0
    };
  },
  computed: {
    canPublish() {
      return window.apos.modules['@apostrophecms/submitted-draft'].canPublish;
    },
    tooltip() {
      if (this.count > 0) {
        return 'apostrophe:manageDraftSubmissions';
      } else {
        return 'apostrophe:noDraftSubmissions';
      }
    }
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
    open() {
      apos.bus.$emit('admin-menu-click', '@apostrophecms/submitted-draft:manager');
    },
    async updateCount() {
      try {
        // If tab is visible
        if (document.visibilityState !== 'hidden') {
          this.count = (await apos.http.get(apos.modules['@apostrophecms/submitted-draft'].action, {
            qs: {
              count: 1,
              aposMode: 'draft'
            }
          })).count;
        }
      } catch (e) {
        console.error(e);
      } finally {
        // Not declared in data() because it is not reactive
        this.timeout = setTimeout(this.updateCount, 10000);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  ::v-deep .apos-submitted-drafts__counter {
    display: inline-flex;
    margin-left: $spacing-half;
    padding: 3px;
    background-color: var(--a-primary-transparent-10);
    border-radius: var(--a-border-radius);
    color: var(--a-primary);
    min-width: 15px;
    min-height: 15px;
    align-items: center;
    justify-content: center;
    font-size: var(--a-type-small);
    line-height: 0.9;
  }
</style>

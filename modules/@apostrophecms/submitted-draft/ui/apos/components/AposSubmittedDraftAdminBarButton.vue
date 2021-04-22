<template>
  <span class="apos-submitted-draft-admin-bar-container">
    <AposButton
      type="subtle"
      @click="$emit('click')"
      :label="label"
      :modifiers="modifiers"
      class="apos-admin-bar__btn"
    />
    <span v-if="count > 0" class="apos-submitted-draft-admin-bar-counter">
      {{ count }}
    </span>
  </span>
</template>
<script>
export default {
  name: 'AposSubmittedDraftAdminBarButton',
  props: {
    type: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    modifiers: {
      type: Array,
      required: true
    }
  },
  emits: [ 'click' ],
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

<style lang="scss" scoped>
  .apos-submitted-draft-admin-bar-container {
    position: relative;
  }
  .apos-submitted-draft-admin-bar-counter {
    position: absolute;
    display: inline-block;
    top: -2px;
    right: -2px;
    font-size: 75%;
    /* TODO: these need to come from variables, I reviewed and didn't
      find likely candidates in the theme */
    color: white;
    background-color: red;
    border-radius: 100%;
    width: 16px;
    height: 16px;
    text-align: center;
    vertical-align: center;
  }
</style>

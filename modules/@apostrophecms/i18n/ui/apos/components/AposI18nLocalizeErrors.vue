<template>
  <ul class="apos-confirm__notifications">
    <li v-for="(item, index) in notifications" :key="index" class="apos-confirm__notification">
      <div :class="className(item.type)">
        <span class="apos-confirm__notification-locale">{{ item.locale.label }}</span>
        <div class="apos-confirm__notification-meta">
          <span class="apos-confirm__notification-title">
            <CheckIcon
              v-if="!isError(item.type)"
              class="apos-check"
              :size="12"
            />
            <CancelIcon
              v-if="isError(item.type)"
              class="apos-error"
              :size="12"
            />
            {{ item.doc.title }}
          </span>
          <span class="apos-confirm__notification-item-type">{{ docType(item.doc) }}</span>
        </div>
        <div class="apos-confirm__notification-detail" v-if="item.detail">
          {{ $t(item.detail) }}
        </div>
      </div>
    </li>
  </ul>
</template>

<script>
import CheckIcon from 'vue-material-design-icons/Check.vue';
import CancelIcon from 'vue-material-design-icons/Cancel.vue';

export default {
  name: 'AposI18nLocalizeErrors',
  components: { CheckIcon, CancelIcon },
  props: {
    notifications: {
      required: true,
      type: Array
    }
  },
  methods: {
    className(type) {
      return `apos-confirm--${type}`;
    },
    singular(name) {
      const module = apos.modules[name] || {};
      if (module.action === '/api/v1/@apostrophecms/page') {
        return 'apostrophe:page';
      }
      return module.label || name;
    },
    docType(doc) {
      return this.$t(this.singular(doc.type));
    },
    isError(type) {
      return type === 'error';
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-confirm__notifications {
  @include type-base;
  list-style-type: none;
  padding-top: 0;
  padding-bottom: 0;
  margin-left: 0;
  text-align: left;
}

.apos-confirm__notification:not(:last-of-type)  {
  margin-bottom: $spacing-base;
}

.apos-confirm__notification {
  width: 260px;
}

.apos-confirm__notification-meta {
  display: flex;
  justify-content: center;
  align-items: center;
}

.apos-confirm__notification-detail {
  margin-top: 8px;
  color: var(--a-danger);
}

.apos-check,
.apos-error {
  position: absolute;
  left: -17px;
  display: inline-block;
  width: 12px;
  height: 12px;
  background-size: contain;
}

.apos-check {
  color: var(--a-success);
}

.apos-error {
  color: var(--a-danger);
}

.apos-confirm__notification,
.apos-confirm__notification-locale {
  display: block;
}

.apos-confirm__notification-locale {
  font-size: var(--a-type-large);
  margin-bottom: $spacing-base;
}

.apos-confirm__notification-title,
.apos-confirm__notification-item-type {
  display: inline-block;
  color: var(--a-base-7);
}

.apos-confirm__notification-title {
  position: relative;
  margin-right: $spacing-base;
  margin-left: 17px;
}

.apos-confirm__notification-item-type {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 3px;
  border: 1px solid var(--a-base-7);
  font-size: var(--a-type-small);
}
</style>

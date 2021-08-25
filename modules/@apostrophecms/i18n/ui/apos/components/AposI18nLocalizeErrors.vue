<template>
  <ul class="apos-confirm__notifications">
    <li>Something</li>
    <li v-for="item in notifications" v-html="item" :key="index" class="apos-confirm__notification">
      <div class="apos-confirm--{{ item.type }}">
        <span class="apos-confirm__notification-locale">{{ item.locale.label }}</span>
        <div class="apos-confirm__notificaton-meta">
          <span class="apos-confirm__notification-title">{{ item.doc.title }}</span> <span class="apos-confirm__notification-item-type">{{ item.doc.type }}</span>
        </div>
      </div>
    </li>
  </ul>
</template>

<script>

export default {
  name: 'AposI18nLocalizeErrors',
  props: {
    notifications: {
      required: true,
      type: Array
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-confirm__notifications {
  @include type-base;
}

.apos-confirm__notifications {
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

.apos-confirm__notificaton-meta {
  display: flex;
  justify-content: center;
  align-items: center;
}

.apos-confirm--success .apos-confirm__notification-title::before,
.apos-confirm--error .apos-confirm__notification-title::before {
  content: '';
  position: absolute;
  left: -17px;
  display: inline-block;
  width: 12px;
  height: 12px;
  background-size: contain;
}

.apos-confirm--success .apos-confirm__notification-title::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 0 24 24' width='24px' fill='%2300bf9a'%3E%3Cpath d='M0 0h24v24H0z' fill='none'/%3E%3Cpath d='M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'/%3E%3C/svg%3E");
}

.apos-confirm--error .apos-confirm__notification-title::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 0 24 24' width='24px' fill='%23eb443b'%3E%3Cpath d='M0 0h24v24H0z' fill='none'/%3E%3Cpath d='M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM17 15.74L15.74 17 12 13.26 8.26 17 7 15.74 10.74 12 7 8.26 8.26 7 12 10.74 15.74 7 17 8.26 13.26 12 17 15.74z'/%3E%3C/svg%3E");
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

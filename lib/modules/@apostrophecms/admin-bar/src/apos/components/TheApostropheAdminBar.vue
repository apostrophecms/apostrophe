<template>
  <div class="apos-admin-bar">
    <div class="apos-admin-bar__logo">
      <ApostropheLogo />
    </div>
    <div v-for="item in items" class="apos-admin-bar__item">
      <component
        v-if="item.options" :is="item.options.href ? 'a' : 'button'"
        class="apos-admin-bar__trigger" :href="item.options.href"
        v-on="item.options.href ? {} : { click: () => emitEvent(item.name) }"
      >
        {{ item.label }}
      </component>
      <button
        v-else-if="item.menu" class="apos-admin-bar__trigger"
        @click="toggleDropdown"
      >
        {{ item.label }}
      </button>
      <ul
        v-if="item.menu" class="apos-admin-bar__dropdown-items"
        data-apos-dropdown-items
      >
        <li v-for="subItem in item.items" class="apos-admin-bar__dropdown-item">
          <component
            v-if="subItem.options" :is="subItem.options.href ? 'a' : 'button'"
            class="apos-admin-bar__trigger" :href="subItem.options.href"
            v-on="subItem.options.href ? {} : { click: () => emitEvent(subItem.name) }"
          >
            {{ subItem.label }}
          </component>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import ApostropheLogo from './svg/ApostropheLogo';

export default {
  name: 'TheApostropheAdminBar',
  components: { ApostropheLogo },
  props: {
    items: Array
  },
  methods: {
    emitEvent: function (name) {
      console.log(name);
      apos.bus.$emit('adminBarItem', name);
    },
    toggleDropdown: function () {
    }
  }
};
</script>

<style>
body {
  margin-top: 63px;
}

.apos-admin-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 63px;
  padding: 0 24px;
  background: var(--a-background-inverted);
  font-family: $font-default;
  font-size: map-get($font-sizes, default);
  line-height: 1;
}

.apos-admin-bar__logo,
.apos-admin-bar__item {
  position: relative;
  display: inline-block;
  vertical-align: middle;
}

.apos-admin-bar__logo {
  margin-right: 25px;
}

.apos-admin-bar__trigger {
  display: block;
  margin: 0;
  padding: 25px;
  border: 0;
  color: var(--a-base-10);
  background: transparent;
  text-decoration: none;
  cursor: pointer;
}

.apos-admin-bar__trigger:hover {
  background: var(--a-base-1);
}

.apos-admin-bar__dropdown-items .apos-admin-bar__trigger {
  padding: 25px;
}

.apos-admin-bar__dropdown-items {
  position: absolute;
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--a-base-10);
}
</style>

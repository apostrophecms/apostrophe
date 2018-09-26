<template>
  <div class="apos-ui">
    <div class="apos-admin-bar apos-text-meta" data-apos-admin-bar>
      <div class="apos-admin-bar-inner">
        <div class="apos-admin-bar-logo" data-apos-admin-bar-logo data-apos-actionable="data-apos-admin-bar">
          A
        </div>
        <div v-for="item in items" class="apos-admin-bar-item">
          <div class="apos-admin-bar-item-inner">
            <component v-if="item.options" :is="item.options.href ? 'a' : 'button'" :href="item.options.href" :data-apos-admin-bar-item="item.name" v-on="item.options.href ? {} : { click: () => emitEvent(item.name) }">
              {{ item.label }}
            </component>
            <button v-else :data-apos-dropdown="item.menu">{{ item.label }}</button>
            <ul v-if="item.menu" class="apos-dropdown-items" data-apos-dropdown-items>
              <li v-for="subItem in item.items" class="apos-dropdown-item" :data-apos-admin-bar-item="subItem.name">
                <component v-if="subItem.options" :is="subItem.options.href ? 'a' : 'button'" :href="subItem.options.href" :data-apos-admin-bar-item="subItem.name" v-on="subItem.options.href ? {} : { click: () => emitEvent(subItem.name) }">
                  {{ subItem.label }}
                </component>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TheApostropheAdminBar',
  props: {
    items: Array
  },
  methods: {
    emitEvent: function (name) {
      apos.bus.$emit('adminBarItem', name);
    }
  }
}
</script>

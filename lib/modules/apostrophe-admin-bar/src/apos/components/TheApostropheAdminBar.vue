<template>
  <div class="apos-ui">
    <div class="apos-admin-bar apos-text-meta" data-apos-admin-bar>
      <div class="apos-admin-bar-inner">
        <div class="apos-admin-bar-logo" data-apos-admin-bar-logo data-apos-actionable="data-apos-admin-bar">
          A
        </div>
        <div v-for="item in items" class="apos-admin-bar-item">
          <div class="apos-admin-bar-item-inner" :data-apos-admin-bar-item="item.name">
            <component :is="item.options.href ? 'a' : 'span'" :href="item.options.href">
              {{ item.label }}
            </component>
            <ul v-if="item.menu" class="apos-dropdown-items" data-apos-dropdown-items>
              <li v-for="subItem in item.items" class="apos-dropdown-item" :data-apos-admin-bar-item="subItem.name">
                {{ subItem.label }}
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
  }
}
</script>

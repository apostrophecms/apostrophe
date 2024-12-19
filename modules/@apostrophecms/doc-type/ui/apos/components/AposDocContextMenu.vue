<template>
  <AposContextMenu
    class="apos-admin-bar_context-button"
    :menu="menu"
    :disabled="disabled || (menu.length === 0)"
    menu-placement="bottom-end"
    :button="{
      tooltip: { content: 'apostrophe:moreOptions', placement: 'bottom' },
      label: 'apostrophe:moreOptions',
      icon: 'dots-vertical-icon',
      iconOnly: true,
      type: 'subtle',
      modifiers: ['small', 'no-motion']
    }"
    @item-clicked="menuHandler"
    @open="$emit('menu-open')"
    @close="$emit('menu-close')"
  />
</template>

<script>
import AposDocContextMenuLogic from 'Modules/@apostrophecms/doc-type/logic/AposDocContextMenu';

export default {
  name: 'AposDocContextMenu',
  mixins: [ AposDocContextMenuLogic ],
  emits: [ 'menu-open', 'menu-close', 'close' ]
};
</script>

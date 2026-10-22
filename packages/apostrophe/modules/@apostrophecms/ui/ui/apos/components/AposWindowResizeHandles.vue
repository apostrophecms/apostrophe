<template>
  <div
    v-for="handle in handles"
    :key="handle.edge"
    :class="[
      'apos-window__resize-handle',
      handle.type === 'corner'
        ? `apos-window__resize-handle--corner apos-window__resize-handle--corner-${handle.edge}`
        : `apos-window__resize-handle--${handle.edge}`
    ]"
    role="presentation"
    aria-hidden="true"
    :data-apos-test="`resize-handle-${handle.edge}`"
    @mousedown.stop="(e) => emit('resize', e, handle.edge)"
  >
    <AposIndicator
      v-if="handle.edge === iconCorner"
      icon="resize-bottom-right-icon"
      :icon-size="18"
      icon-color="var(--a-base-0)"
    />
  </div>
</template>

<script setup>
// The edge and corner handles of a window, for the `startResizing` of
// `useDraggableWindow`. The window must be positioned
defineProps({
  // The corner that shows the resize icon, if any
  iconCorner: {
    type: String,
    default: null
  }
});

const emit = defineEmits([ 'resize' ]);

const handles = [
  {
    type: 'edge',
    edge: 'n'
  },
  {
    type: 'edge',
    edge: 'e'
  },
  {
    type: 'edge',
    edge: 's'
  },
  {
    type: 'edge',
    edge: 'w'
  },
  {
    type: 'corner',
    edge: 'nw'
  },
  {
    type: 'corner',
    edge: 'ne'
  },
  {
    type: 'corner',
    edge: 'sw'
  },
  {
    type: 'corner',
    edge: 'se'
  }
];
</script>

<style lang="scss" scoped>
$corner-handle-size: 18px;
$edge-handle-size: 2px;

.apos-window__resize-handle {
  z-index: $z-index-default;
  position: absolute;
  transition: background-color 200ms ease;
}

// Edge handles
.apos-window__resize-handle--n,
.apos-window__resize-handle--s {
  right: 0;
  left: 0;
  height: $edge-handle-size;
  cursor: ns-resize;
}

.apos-window__resize-handle--n {
  top: 0;
}

.apos-window__resize-handle--s {
  bottom: 0;
}

.apos-window__resize-handle--w,
.apos-window__resize-handle--e {
  top: 0;
  bottom: 0;
  width: $edge-handle-size;
  cursor: ew-resize;
}

.apos-window__resize-handle--w {
  left: 0;
}

.apos-window__resize-handle--e {
  right: 0;
}

// Corner handles
.apos-window__resize-handle--corner {
  width: $corner-handle-size;
  height: $corner-handle-size;

  &:hover {
    border-radius: 2px;
  }
}

.apos-window__resize-handle--corner-nw {
  top: 2px;
  left: 2px;
  cursor: nwse-resize;
}

.apos-window__resize-handle--corner-ne {
  top: 2px;
  right: 2px;
  cursor: nesw-resize;
}

.apos-window__resize-handle--corner-sw {
  bottom: 2px;
  left: 2px;
  cursor: nesw-resize;

  .apos-indicator {
    transform: scaleX(-1);
  }
}

.apos-window__resize-handle--corner-se {
  right: 2px;
  bottom: 2px;
  cursor: nwse-resize;
}
</style>

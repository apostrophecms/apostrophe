<template>
  <div class="apos-table-control">
  </div>
</template>

<script>

export default {
  name: 'AposTiptapTable',
  props: {
    name: {
      type: String,
      required: true
    },
    editor: {
      type: Object,
      required: true
    },
    tool: {
      type: Object,
      required: true
    }
  },
  data() {
    return {};
  },
  computed: {},
  methods: {}
};
</script>

<style lang="scss">
.ProseMirror {
  table {
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0;
    overflow: hidden;

    td,
    th {
      min-width: 1em;
      border: 2px solid #ced4da;
      padding: 3px 5px;
      vertical-align: top;
      box-sizing: border-box;
      position: relative;

      > * {
        margin-bottom: 0;
      }
    }

    th {
      font-weight: bold;
      text-align: left;
      background-color: #f1f3f5;
    }

    .selectedCell:after {
      z-index: 2;
      position: absolute;
      content: "";
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      background: rgba(200, 200, 255, 0.4);
      pointer-events: none;
    }

    .column-resize-handle {
      position: absolute;
      right: -2px;
      top: 0;
      bottom: -2px;
      width: 4px;
      background-color: #adf;
      pointer-events: none;
    }

    p {
      margin: 0;
    }
  }
}

.tableWrapper {
  padding: 1rem 0;
  overflow-x: auto;
}

.resize-cursor {
  cursor: ew-resize;
  cursor: col-resize;
}

.apos-table-control {
  position: relative;
  display: inline-block;
}

.apos-table-control__dialog {
  z-index: $z-index-modal;
  position: absolute;
  top: calc(100% + 5px);

  .apos-context-menu__dialog--group {
    display: flex;
    flex-direction: row;
  }
}
</style>

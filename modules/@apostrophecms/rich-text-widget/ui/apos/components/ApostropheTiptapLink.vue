<template>
  <div class="apos-link-control">
    <button
      @click="click"
      ref="button"
    >
      {{ tool.label }}
    </button>
    <div class="apos-link-control__dialog">
      <v-popover
        @hide="close"
        :offset="10"
        placement="bottom-start"
        :open="active"
        :delay="{ show: 0, hide: 0 }"
        popover-class="apos-popover"
      >
        <template #popover>
          <AposContextMenuDialog
            menu-placement="bottom-start"
          >
            <form>
              <!-- <label for="href">URL</label><input v-model="href" /> -->
              <AposInputString
                :field="href.field"
                :value="href.value"
                :modifiers="['small']"
              />
              <AposInputString
                :field="id.field"
                :value="id.value"
                :modifiers="['small']"
              />
              <AposInputSelect
                :field="target.field"
                :value="target.value"
                :modifiers="['small']"
              />
              <!-- <label for="id">Anchor Name</label><input v-model="id" /> -->
              <!-- <label for="target">Target</label><input v-model="target" /> -->
            </form>
          </AposContextMenuDialog>
        </template>
      </v-popover>
    </div>

    <!-- <ApostropheModal v-if="active">
      <template slot="header">
        <p>Link</p>
      </template>
      <template slot="body">

      </template>
      <template slot="footer">
        <slot name="footer">
          <button class="modal-default-button" @click="close">
            Cancel
          </button>
          <button class="modal-default-button" @click="save()">
            Save
          </button>
        </slot>
      </template>
    </ApostropheModal> -->
  </div>
</template>

<script>
import klona from 'klona';
import {
  VPopover
} from 'v-tooltip';

export default {
  name: 'ApostropheTiptapLink',
  components: {
    'v-popover': VPopover
  },
  props: {
    name: {
      type: String,
      required: true
    },
    tool: {
      type: Object,
      required: true
    },
    editor: {
      type: Object,
      required: true
    }
  },
  data () {
    const field = {
      name: '',
      label: '',
      placeholder: '',
      help: false,
      required: false,
      disabled: false
    };
    const value = {
      data: '',
      error: false
    };

    return {
      href: null,
      id: null,
      target: null,
      active: false,
      blankField: field,
      blankValue: value
    };
  },
  computed: {
    hasSelection() {
      return this.editor.selection.from !== this.editor.selection.to;
    }
  },
  created() {
    this.resetFields();
  },
  methods: {
    click() {
      if (this.hasSelection) {
        this.resetFields();
        this.populateFields();
        this.active = !this.active;
      }
    },
    close() {
      this.active = false;
      this.editor.focus();
    },
    save() {
      this.editor.commands[this.name]({
        href: this.href.value.data,
        id: this.id.value.data,
        target: this.target.value.data
      });
      this.active = false;
    },
    populateFields() {
      if (this.active) {
        const values = this.editor.getMarkAttrs('link');
        this.href.value.data = values.href;
        this.id.value.data = values.id;
        this.target.value.data = values.target;
      }
    },
    resetFields() {
      this.href = {
        field: {
          ...klona(this.blankField),
          name: 'url',
          label: 'URL',
          help: 'Relative or absolute, the power is yours'
        },
        value: klona(this.blankValue)
      };

      this.id = {
        field: {
          ...klona(this.blankField),
          name: 'id',
          label: 'Anchor Name',
          help: 'This becomes the ID of your selection'
        },
        value: klona(this.blankValue)
      };

      this.target = {
        field: {
          ...klona(this.blankField),
          name: 'target',
          label: 'Target',
          help: 'Where the new link opens up',
          choices: [
            {
              label: 'Current browsing context (_self)',
              value: '_self'
            },
            {
              label: 'New tab or window (_blank)',
              value: '_blank'
            },
            {
              label: 'Parent browsing context (_parent)',
              value: '_parent'
            },
            {
              label: 'Topmost browsing context (_top)',
              value: '_top'
            }
          ]
        },
        value: klona(this.blankValue)
      };
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-link-control {
    display: inline-block;
  }

  .apos-link-control__dialog {
    z-index: $z-index-modal-bg;
    position: absolute;
  }
</style>

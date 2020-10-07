<template>
  <div class="apostrophe-tiptap-link-control">
    <button 
      class="apos-tiptap-control apos-tiptap-control--button"
      @click="click"
    >
      {{ tool.label }}
    </button>
    <ApostropheModal v-if="active">
      <template slot="header">
        <!-- TODO i18n -->
        <p>Link</p>
      </template>
      <template slot="body">
        <form v-if="active">
          <fieldset>
            <label for="href">URL</label><input v-model="href" />
          </fieldset>
          <fieldset>
            <label for="id">Anchor Name</label><input v-model="id" />
          </fieldset>
          <fieldset>
            <label for="target">Target</label><input v-model="target" />
          </fieldset>
        </form>
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
    </ApostropheModal>
  </div>
</template>


  </div>
</template>

<script>

export default {
  name: 'ApostropheTiptapLink',
  props: {
    name: String,
    tool: Object,
    editor: Object
  },
  data () {
    return {
      href: '',
      id: '',
      target: '',
      active: false
    };
  },
  methods: {
    click() {
      this.active = !this.active;
      if (this.active) {
        const values = this.editor.getMarkAttrs('link');
        this.href = values.href;
        this.id = values.id;
        this.target = values.target;
      }
    },
    close() {
      this.active = false;
      this.editor.focus();
    },
    save() {
      this.editor.commands[this.name]({
        href: this.href,
        id: this.id,
        target: this.target
      });
      this.active = false;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apostrophe-tiptap-link-control {
    display: inline-block;
  }
</style>

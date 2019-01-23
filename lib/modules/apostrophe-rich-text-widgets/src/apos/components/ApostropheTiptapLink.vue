<template>
  <div>
    <button @click="click()">
      {{ options.label }}
    </button>
    <ApostropheModal v-if="active" @close="$emit('close')">
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
            <label for="name">Anchor Name</label><input v-model="nameAttr" />
          </fieldset>
          <fieldset>
            <label for="target">Target</label><input v-model="target" />
          </fieldset>
        </form>
      </template>
      <template slot="footer">
        <slot name="footer">
          <button class="modal-default-button" @click="$emit('close')">
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
    options: Object,
    editor: Object
  },
  data () {
    return {
      href: '',
      nameAttr: '',
      target: '',
      active: false
    };
  },
  methods: {
    click() {
      this.active = !this.active;
      if (this.active) {
        const values = this.editor.getMarkAttrs('link');
        console.log('values:', values);
        this.href = values.href;
        this.nameAttr = values.name;
        this.target = values.target;
      }
    },
    close() {
      this.active = false;
    },
    save() {
      console.log({
        href: this.href,
        name: this.nameAttr,
        target: this.target
      });
      this.editor.commands[this.name]({
        href: this.href,
        name: this.nameAttr,
        target: this.target
      });
      this.active = false;
    }
  }
};
</script>

<template>
  <div class="apos-area-add-widget-menu">
    <button @click="dropdown = !dropdown">+ Add Widget</button>
    <div v-if="dropdown" class="apos-area-add-widget-menu-dropdown">
      <button v-for="choice in choices" @click="add(choice.name)">{{ choice.label }}</button>
    </div>
    <component :is="addWidgetEditor" v-if="adding" v-model="widget" :type="addWidgetType" @close="close()" @save="insert()" :options="addWidgetOptions" />
  </div>
</template>

<script>

export default {
  name: 'ApostropheAddWidgetMenu',
  props: {
    choices: Array,
    index: Number,
    widgetOptions: Object
  },
  data() {
    return {
      dropdown: false,
      adding: false,
      addWidgetEditor: null,
      addWidgetOptions: null,
      addWidgetType: null,
      widget: null
    }
  },
  methods: {
    add(name) {
      this.adding = !this.adding;
      if (this.adding) {
        this.addWidgetEditor = this.widgetEditorComponent(name);
        this.addWidgetOptions = this.widgetOptions[name];
        this.addWidgetType = name;
      }
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    },
    insert() {
      this.$emit('widgetAdded', {
        index: this.index,
        widget: this.widget
      });
      this.widget = null;
      this.close();
    },
    close() {
      this.adding = false;
      this.dropdown = false;
    }
  },
  computed: {
    moduleOptions() {
      return window.apos.areas;
    }
  }
};

</script>
<style>
.apos-area-add-widget-menu {
  width: 100px;
  border: 2px solid lightblue;
}
</style>

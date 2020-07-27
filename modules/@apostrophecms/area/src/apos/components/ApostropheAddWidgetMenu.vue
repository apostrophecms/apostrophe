<template>
  <div class="apos-area-add-widget-menu">
    <button @click="dropdown = !dropdown">+ Add Widget</button>
    <div v-if="dropdown" class="apos-area-add-widget-menu-dropdown">
      <button v-for="choice in choices" @click="add(choice.name)">{{ choice.label }}</button>
    </div>
    <component :is="addWidgetEditor" v-if="adding" v-model="widget" :type="addWidgetType" @close="close()" @insert="insert" :options="addWidgetOptions" :docId="docId" />
  </div>
</template>

<script>

import cuid from 'cuid';

export default {
  name: 'ApostropheAddWidgetMenu',
  props: {
    choices: Array,
    index: Number,
    widgetOptions: Object,
    docId: String
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
      if (this.widgetIsContextual(name)) {
        return this.insert({
          _id: cuid(),
          type: name,
          ...this.contextualWidgetDefaultData(name)
        });
      } else {
        this.adding = !this.adding;
        if (this.adding) {
          this.addWidgetEditor = this.widgetEditorComponent(name);
          this.addWidgetOptions = this.widgetOptions[name];
          this.addWidgetType = name;
        }
      }
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    },
    widgetIsContextual(type) {
      return this.moduleOptions.widgetIsContextual[type];
    },
    contextualWidgetDefaultData(type) {
      return this.moduleOptions.contextualWidgetDefaultData[type];
    },
    insert(widget) {
      this.$emit('widgetAdded', {
        index: this.index,
        widget
      });
      this.close();
    },
    close() {
      this.adding = false;
      this.dropdown = false;
    }
  },
  computed: {
    moduleOptions() {
      return window.apos.area;
    }
  }
};

</script>
<style>
.apos-area-add-widget-menu {
  width: 100px;
  border: 2px solid var(--a-brand-blue);
}
</style>

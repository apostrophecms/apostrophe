<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
  >
    <template #body>
      <div class="apos-color">
        <AposContextMenu
          :button="buttonOptions"
          @open="open"
          @close="close"
        >
          <Picker
            :value="colors"
            @input="update"
          />
        </AposContextMenu>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import Picker from 'vue-color/src/components/Sketch.vue';

export default {
  name: 'AposInputColor',
  components: {
    Picker
  },
  mixins: [ AposInputMixin ],
  data() {
    return {
      active: false,
      buttonOptions: {
        label: 'Hello world',
        type: 'default'
      }
    };
  },

  computed: {
    classList: function () {
      return [
        'apos-input-wrapper',
        'apos-color'
      ];
    },
    colors() {
      return {
        hex: '#194d33',
        a: 0.6
      };
    }
  },
  methods: {
    open() {
      this.active = true;
    },
    close() {
      this.active = false;
    },
    update(value) {
      console.log('hi update');
      console.log(value);
    }
  }
};
</script>

<style lang="scss" scoped>
  
</style>

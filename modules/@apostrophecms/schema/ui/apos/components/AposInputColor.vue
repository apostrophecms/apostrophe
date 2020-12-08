<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
  >
    <template #body>
      <div class="apos-color">
        <div class="apos-color__ui">
          <AposContextMenu
            :button="buttonOptions"
            @open="open"
            @close="close"
            menu-placement="bottom-start"
            menu-offset="88, 20"
          >
            <Picker
              :value="next"
              @input="update"
            />
          </AposContextMenu>
        </div>
        <div class="apos-color__info">
          {{ valueLabel }}
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import Picker from 'vue-color/src/components/Sketch';
import tinycolor from 'tinycolor2';
import cuid from 'cuid';

export default {
  name: 'AposInputColor',
  components: {
    Picker
  },
  mixins: [ AposInputMixin ],
  data() {
    return {
      active: false,
      tinyColorObj: null,
      id: cuid()
    };
  },
  computed: {
    buttonOptions() {
      return {
        label: this.field.label,
        type: 'color',
        color: this.value.data || '',
        attrs: { 'data-apos-color-input': this.id }
      };
    },
    valueLabel() {
      if (this.next) {
        return this.next;
      } else {
        return 'No color selected';
      }
    },
    preferredFormat() {
      return 'rgb';
    },
    classList() {
      return [
        'apos-input-wrapper',
        'apos-color'
      ];
    }
  },
  mounted() {
    this.tinyColorObj = tinycolor(this.next);
    this.generatePreview();
  },
  methods: {
    generatePreview() {
      const style = document.createElement('style');
      style.type = 'text/css';
      let rule = `[data-apos-color-input="${this.id}"]:after {`;
      rule += `background-color: ${this.tinyColorObj.toString(this.preferredFormat)};`;
      rule += `border: 2px solid ${this.tinyColorObj.lighten(20).toString(this.preferredFormat)};`;
      rule += `opacity: ${this.next ? 1 : 0}`; // hack to simlulate not-yet-set
      rule += '}';
      this.$el.appendChild(style);
      style.innerHTML = rule;
    },
    open() {
      this.active = true;
    },
    close() {
      this.active = false;
    },
    update(value) {
      this.tinyColorObj = tinycolor(value.hsl);
      this.next = this.tinyColorObj.toString(this.preferredFormat);
      this.generatePreview();
    },
    validate(value) {
      if (value == null) {
        value = '';
      }
      const color = tinycolor(value);
      console.log(`value is ${color.isValid()}`);
      return !(color.isValid());
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-color {
    display: flex;
    align-items: center;

    & /deep/ .vc-sketch {
      padding: 0;
      box-shadow: none;
    }
  }

  .apos-color__info {
    @include type-base;
    margin-left: 15px;
  }
</style>

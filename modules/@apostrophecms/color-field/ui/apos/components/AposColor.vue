<template>
  <div
    role="application"
    aria-label="Color picker"
    class="apos-color"
    :class="[disableAlpha ? 'apos-color--disable-alpha' : '']"
  >
    <div class="apos-color__saturation-wrap">
      <Saturation :value="colors" @change="childChange" />
    </div>
    <div class="apos-color__controls">
      <div class="apos-color__sliders">
        <div class="apos-color__hue-wrap">
          <Hue :value="colors" @change="childChange" />
        </div>
        <div v-if="!disableAlpha" class="apos-color__alpha-wrap">
          <Alpha :value="colors" @change="childChange" />
        </div>
      </div>
      <div class="apos-color__color-wrap">
        <div
          :aria-label="`Current color is ${activeColor}`"
          class="apos-color__active-color"
          :style="{ background: activeColor }"
        />
        <Checkboard />
      </div>
    </div>
    <div v-if="!disableFields" class="apos-color__field">
      <!-- rgba -->
      <div class="apos-color__field--double">
        <EdIn
          label="hex"
          :value="hex"
          @change="inputChange"
        />
      </div>
      <div class="apos-color__field--single">
        <EdIn
          label="r"
          :value="colors.rgba.r"
          @change="inputChange"
        />
      </div>
      <div class="apos-color__field--single">
        <EdIn
          label="g"
          :value="colors.rgba.g"
          @change="inputChange"
        />
      </div>
      <div class="apos-color__field--single">
        <EdIn
          label="b"
          :value="colors.rgba.b"
          @change="inputChange"
        />
      </div>
      <div v-if="!disableAlpha" class="apos-color__field--single">
        <EdIn
          label="a"
          :value="colors.a"
          :arrow-offset="0.01"
          :max="1"
          @change="inputChange"
        />
      </div>
    </div>
    <div
      class="apos-color__presets"
      role="group"
      aria-label="A color preset, pick one to set as current color"
    >
      <template v-for="c in presetColors">
        <div
          v-if="!isTransparent(c)"
          :key="`!${c}`"
          class="apos-color__presets-color"
          :aria-label="`Color:${c}`"
          :style="{ background: c }"
          @click="handlePreset(c)"
        />
        <div
          v-else
          :key="c"
          :aria-label="`Color:${c}`"
          class="apos-color__presets-color"
          @click="handlePreset(c)"
        >
          <Checkboard />
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import colorMixin from '../mixins/AposColorMixin';
import editableInput from '../lib/AposColorEditableInput';
import saturation from '../lib/AposColorSaturation';
import hue from '../lib/AposColorHue';
import alpha from '../lib/AposColorAlpha';
import checkboard from '../lib/AposColorCheckerboard';

const presetColors = [
  '#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321',
  '#417505', '#BD10E0', '#9013FE', '#4A90E2', '#50E3C2',
  '#B8E986', '#000000', '#4A4A4A', '#9B9B9B', '#FFFFFF',
  'rgba(0,0,0,0)'
];

export default {
  name: 'AposColor',
  components: {
    Saturation: saturation,
    Hue: hue,
    Alpha: alpha,
    EdIn: editableInput,
    Checkboard: checkboard
  },
  mixins: [ colorMixin ],
  props: {
    presetColors: {
      type: Array,
      default() {
        return presetColors;
      }
    },
    disableAlpha: {
      type: Boolean,
      default: false
    },
    disableFields: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    hex() {
      let hex;
      if (this.colors.a < 1) {
        hex = this.colors.hex8;
      } else {
        hex = this.colors.hex;
      }

      return hex.replace('#', '');
    },
    activeColor() {
      const { rgba } = this.colors;
      return `rgba(${[ rgba.r, rgba.g, rgba.b, rgba.a ].join(',')})`;
    }
  },
  methods: {
    handlePreset(c) {
      this.colorChange(c);
    },
    childChange(data) {
      this.colorChange(data);
    },
    inputChange(data) {
      if (!data) {
        return;
      }

      if (data.hex) {
        this.isValidHex(data.hex) && this.colorChange({
          hex: data.hex,
          source: 'hex'
        });
      } else if (data.r || data.g || data.b || data.a) {
        this.colorChange({
          r: data.r || this.colors.rgba.r,
          g: data.g || this.colors.rgba.g,
          b: data.b || this.colors.rgba.b,
          a: data.a || this.colors.rgba.a,
          source: 'rgba'
        });
      }
    }
  }
};
</script>

<style>
.apos-color {
  position: relative;
  width: 200px;
  padding: 10px 10px 0;
  box-sizing: initial;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .15), 0 8px 16px rgba(0, 0, 0, .15);
}

.apos-color__saturation-wrap {
  width: 100%;
  padding-bottom: 75%;
  position: relative;
  overflow: hidden;
}

.apos-color__controls {
  display: flex;
}

.apos-color__sliders {
  padding: 4px 0;
  flex: 1;
}

.apos-color__sliders .apos-color__hue,
.apos-color__sliders .apos-color__alpha-gradient {
  border-radius: 2px;
}

.apos-color__hue-wrap {
  position: relative;
  height: 10px;
}

.apos-color__alpha-wrap {
  position: relative;
  height: 10px;
  margin-top: 4px;
  overflow: hidden;
}

.apos-color__color-wrap {
  width: 24px;
  height: 24px;
  position: relative;
  margin-top: 4px;
  margin-left: 4px;
  border-radius: 3px;
}

.apos-color__active-color {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .15), inset 0 0 4px rgba(0, 0, 0, .25);
  z-index: 2;
}

.apos-color__color-wrap .apos-color__checkerboard {
  background-size: auto;
}

.apos-color__field {
  display: flex;
  padding-top: 4px;
}

.apos-color__field .apos-color__input {
  width: 90%;
  padding: 4px 0 3px 10%;
  border: none;
  box-shadow: inset 0 0 0 1px #ccc;
  font-size: 10px;
}

.apos-color__field .apos-color__label {
  display: block;
  text-align: center;
  font-size: 11px;
  color: #222;
  padding-top: 3px;
  padding-bottom: 4px;
  text-transform: capitalize;
}

.apos-color__field--single {
  flex: 1;
  padding-left: 6px;
}

.apos-color__field--double {
  flex: 2;
}

.apos-color__presets {
  margin-right: -10px;
  margin-left: -10px;
  padding-left: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.apos-color__presets-color {
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  display: inline-block;
  margin: 0 10px 10px 0;
  vertical-align: top;
  cursor: pointer;
  width: 16px;
  height: 16px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .15);
}

.apos-color__presets-color .apos-color__checkerboard {
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .15);
  border-radius: 3px;
}

.apos-color--disable-alpha .apos-color__color-wrap {
  height: 10px;
}

.apos-popover .apos-color {
  padding: 0;
  box-shadow: none;
}
</style>

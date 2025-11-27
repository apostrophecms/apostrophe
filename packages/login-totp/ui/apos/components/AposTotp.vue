<template>
  <div class="apos-totp">
    <h3
      class="apos-totp__title"
      :class="{'apos-totp__title--success': token && success}"
    >
      {{ token ? $t('aposTotp:loginTitleSetup') : $t('aposTotp:loginTitle') }}
    </h3>
    <div
      v-if="token && !success"
      class="apos-totp__setup"
    >
      <p class="apos-totp__text">
        {{ $t('aposTotp:setupText1') }}
      </p>
      <p class="apos-totp__scan-title">
        {{ $t('aposTotp:setupText2') }}
      </p>
      <canvas
        ref="canvas"
        class="apos-totp__qrcode"
        data-apos-test="totpQrcode"
      />
      <p class="apos-totp__text-grey">
        {{ $t('aposTotp:setupText3') }}
      </p>
      <div class="apos-totp__token-container">
        <p
          class="apos-totp__token"
          data-apos-test="totpToken"
        >
          {{ token }}
        </p>
        <button
          class="apos-totp__text-grey apos-totp__copy-token-btn"
          data-apos-test="totpCopyToken"
          @click="copyToken(token)"
        >
          <AposIndicator
            icon="content-copy-icon"
            class="apos-button__icon"
          />
          <span class="apos-totp__copy-token-text">
            {{ $t('aposTotp:copyKey') }}
          </span>
        </button>
        <AposIndicator
          v-if="copying"
          icon="check-circle-icon"
          class="apos-button__icon apos-totp__token-copied"
          icon-color="#00bf9a"
        />
        <AposIndicator
          v-if="copying === 'error'"
          icon="alert-circle-icon"
          class="apos-button__icon apos-totp__token-copied"
          icon-color="#ea433a"
        />
      </div>
    </div>
    <div
      v-if="!token || (token && !success)"
      class="apos-topt__login"
    >
      <p
        v-if="token"
        class="apos-totp__text apos-totp__login-text"
      >
        {{ $t('aposTotp:loginText') }}
      </p>
      <form
        class="apos-totp__login-form"
        data-apos-test="totpForm"
        @submit.prevent="sendCode"
      >
        <input
          v-for="(_, i) in code"
          :key="i"
          ref="inputs"
          v-model="code[i]"
          class="apos-totp__login-input"
          :class="{
            'apos-totp__login-input--filled': code[i],
            'apos-totp__login-input--error': errorMsg
          }"
          type="number"
          placeholder="0"
          @keydown="handleKeyDown($event, i)"
          @keyup="handleKeyUp"
          @paste.prevent="pasteCode"
        >
        <AposButton
          ref="submit"
          :busy="busy"
          :disabled="verifyDisabled"
          :class="{'apos-totp__login-submit--disabled': verifyDisabled}"
          type="primary"
          label="aposTotp:verify"
          button-type="submit"
          class="apos-totp__login-submit"
          :modifiers="['gradient-on-hover', 'block']"
          @click="sendCode"
        />
      </form>
      <p class="apos-totp__error">
        {{ errorMsg }}
      </p>
    </div>
    <div
      v-if="token && success"
      class="apos-totp__success"
    >
      <p class="apos-totp__text">
        {{ $t('aposTotp:successMessage') }}
      </p>
      <AposIndicator
        icon="check-decagram-icon"
        class="apos-button__icon"
        icon-color="#00bf9a"
        :icon-size="77"
      />
    </div>
  </div>
</template>

<script>
import qrcode from 'qrcode';

export default {
  props: {
    token: {
      type: String,
      default: null
    },
    identity: {
      type: String,
      default: ''
    },
    success: {
      type: Boolean,
      default: false
    },
    error: {
      type: Error,
      default: null
    }
  },
  emits: [ 'done', 'block', 'confirm' ],
  data() {
    return {
      code: Array(6).fill(''),
      copying: false,
      busy: false,
      controlOrMetaKeyPressed: false,
      errorMsg: ''
    };
  },
  computed: {
    verifyDisabled () {
      return this.code.some((digit) => !digit);
    }
  },
  watch: {
    async success (newVal) {
      this.busy = false;

      if (newVal) {
        if (this.token) {
          await this.awaiting(3000);
        }

        this.$emit('confirm');
      }
    },
    error (newVal) {
      if (newVal) {
        this.busy = false;
        this.errorMsg = newVal.body.message;
      }
    },
    code () {
      this.errorMsg = '';

    }
  },
  mounted () {
    if (this.token && this.$refs.canvas) {
      const otpUrl = `otpauth://totp/${this.identity}?secret=${this.token}&period=30`;

      qrcode.toCanvas(this.$refs.canvas, otpUrl);
    }

    if (this.$refs.inputs) {
      this.$refs.inputs[0].focus();
    }
  },
  methods: {
    sendCode () {
      this.busy = true;
      this.$emit('done', this.code.join(''));
    },
    async copyToken (token) {
      const time = 1200;

      try {
        await navigator.clipboard.writeText(token);

        this.copying = true;

        await this.awaiting(time);
        this.copying = false;
      } catch (err) {
        this.copying = 'error';

        await this.awaiting(time);
        this.copying = false;
      }
    },
    handleKeyDown (e, i) {
      const digit = this.code[i];
      const isNumber = !isNaN(parseInt(e.key, 10));
      const isPasting = this.controlOrMetaKeyPressed && e.key === 'v';

      if ([ 'Control', 'Meta' ].includes(e.key)) {
        this.controlOrMetaKeyPressed = true;
      }

      if (e.key !== 'Tab' && !isPasting) {
        e.preventDefault();
      }

      if (isNumber) {
        this.code.splice(i, 1, e.key);

        this.focusNextInput(i);
      }

      if (e.key === 'ArrowLeft') {
        this.focusNextInput(i, true);
      }

      if (e.key === 'ArrowRight') {
        this.focusNextInput(i);
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (digit) {
          this.code.splice(i, 1, '');
        } else {
          this.focusNextInput(i, e.key === 'Backspace' && true);
        }
      }
    },

    handleKeyUp (e) {
      if ([ 'Control', 'Meta' ].includes(e.key)) {
        this.controlOrMetaKeyPressed = false;
      }
    },

    focusNextInput (i, previous = false) {
      const inputs = this.$refs.inputs;

      if (previous) {
        if (inputs[i - 1]) {
          inputs[i - 1].focus();
        } else {
          inputs[inputs.length - 1].focus();
        }

        return;
      }

      if (inputs[i + 1]) {
        inputs[i + 1].focus();
      } else {
        this.$nextTick(() => {
          this.$refs.submit.$el.children[0].focus();
        });
      }
    },

    pasteCode (e) {
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) {
        return;
      }

      const codeFromClipboard = clipboardData.getData('Text') ||
        clipboardData.getData('text/plain');

      const code = codeFromClipboard.substring(0, 6);
      const codeNumber = parseInt(code, 10);

      if (isNaN(codeNumber)) {
        return;
      }

      code.split('').forEach((num, i) => {
        this.code.splice(i, 1, num);
      });
    },

    awaiting (time) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, time);
      });
    }
  }
};
</script>
<style lang='scss' src="./AposTotp.scss" scoped></style>

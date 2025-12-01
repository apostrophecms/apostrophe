<template>
  <div
    class="apos-popover apos-ai-helper-text__dialog"
    x-placement="bottom"
    :class="{
      'apos-is-triggered': true,
      'apos-has-selection': true
    }"
  >
    <div class="apos-ai-helper-form">
      <p>
        {{ $t('aposAiHelper:textPromptLabel') }}
      </p>
      <textarea v-model="prompt" />
      <p v-if="error">
        {{ $t('aposAiHelper:errorMessage') }}
      </p>
    </div>
    <footer class="apos-ai-helper-text__footer">
      <AposButton
        type="default"
        label="apostrophe:cancel"
        :modifiers="formModifiers"
        @click="cancel"
      />
      <AposButton
        type="primary"
        label="aposAiHelper:generateTextAction"
        :disabled="!prompt.length"
        :modifiers="formModifiers"
        @click="save"
      />
    </footer>
  </div>
</template>

<script>
export default {
  name: 'AposAiHelperTextDialog',
  props: {
    editor: {
      type: Object,
      required: true
    },
    options: {
      type: Object,
      required: true
    }
  },
  emits: [ 'close', 'before-commands' ],
  data() {
    return {
      prompt: '',
      error: false,
      formModifiers: [ 'small', 'margin-micro' ]
    };
  },
  mounted() {
    window.addEventListener('keydown', this.keyboardHandler);
  },
  unmounted() {
    window.removeEventListener('keydown', this.keyboardHandler);
  },
  methods: {
    cancel() {
      this.$emit('close');
    },
    done() {
      this.$emit('close');
    },
    async save() {
      this.error = false;
      try {
        const headingLevels = (this.options.styles || []).filter(style => style.tag.match(/^h\d$/)).map(style => parseInt(style.tag.replace(/h/i, '')));
        const result = await apos.http.post(`${getOptions().action}/ai-helper`, {
          body: {
            prompt: this.prompt,
            headingLevels
          },
          busy: true
        });
        this.$emit('before-commands');
        // newlines shouldn't matter but they do to tiptap, so get rid of them
        const html = result.html.replace(/>\n+</g, '><');
        this.editor.commands.insertContent(html);
        this.done();
      } catch (e) {
        this.error = true;
      }
    },
    keyboardHandler(e) {
      if (e.keyCode === 27) {
        this.cancel();
      }
    }
  }
};

function getOptions() {
  return apos.modules['@apostrophecms/rich-text-widget'];
}
</script>

<style lang="scss" scoped>
  .apos-ai-helper-text__dialog {
    width: 500px;
  }

  .apos-ai-helper-text__dialog.apos-is-triggered {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-context-menu__dialog {
    width: 500px;
  }

  p {
    font-size: 14px;
    line-height: 1.25;
  }

  textarea {
    width: 100%;
    line-height: 1.25;
    padding: 4px;
    height: 48px;
    resize: none;
  }

  .apos-ai-helper-text__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-ai-helper-text__footer .apos-button__wrapper {
    margin-left: 7.5px;
  }

  .apos-ai-helper-text__remove {
    display: flex;
    justify-content: flex-end;
  }
</style>

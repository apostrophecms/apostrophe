<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <input
          :id="uid"
          v-model="next.url"
          :class="classes"
          type="url"
          :placeholder="$t(field.placeholder)"
          :disabled="field.readOnly"
          :readonly="tempReadOnly"
          :required="field.required"
          :tabindex="tabindex"
        >
        <component
          :is="icon"
          v-if="icon"
          :size="iconSize"
          class="apos-input-icon"
        />
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="!error && oembedResult.html"
          class="apos-input__embed"
          :class="{ 'apos-is-dynamic': !!dynamicRatio }"
          :style="{ paddingTop: dynamicRatio && `${(dynamicRatio * 100)}%` }"
          v-html="oembedResult.html"
        />
      </div>
      <!-- eslint-enable vue/no-v-html -->
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputOembed',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data () {
    return {
      next: (this.modelValue && this.modelValue.data)
        ? { ...this.modelValue.data }
        : {},
      oembedResult: {},
      dynamicRatio: '',
      oembedError: null,

      // This variable will set the input as readonly,
      // not disabled, in order to avoid losing focus.
      tempReadOnly: false
    };
  },
  computed: {
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    },
    classes () {
      return [ 'apos-input', 'apos-input--oembed' ];
    },
    icon () {
      if (this.error) {
        return 'circle-medium-icon';
      } else {
        return null;
      }
    }
  },
  async mounted() {
    if (this.next && this.next.url) {
      await this.loadOembed();
    }
  },
  methods: {
    validate(value) {
      if (value == null || value.url === null) {
        value = {};
      }

      if (!value.url && !this.field.required) {
        // field is now empty and not required, not an error
        return false;
      }

      if (
        this.field.oembedType && this.oembedResult.type &&
        this.oembedResult.type !== this.field.oembedType
      ) {
        return { message: this.$t('apostrophe:oembedTypeNotSupported') };
      } else if (this.oembedError) {
        return this.oembedError.message
          ? {
            message: this.oembedError.message
          }
          : 'invalid';
      }

      if (this.field.required) {
        if (!value || !value.url) {
          return 'required';
        }
      }
      return false;
    },
    async watchNext () {
      await this.loadOembed();

      this.validateAndEmit();
    },
    async loadOembed () {
      this.tempReadOnly = true;
      this.oembedResult = {};
      this.oembedError = null;
      this.dynamicRatio = '';

      try {
        const result = await apos.http.get(`${apos.oembed.action}/query`, {
          busy: true,
          qs: {
            url: this.next.url
          }
        });
        this.next.title = result.title || '';
        this.next.thumbnail = result.thumbnail_url || '';
        this.oembedResult = result;

        if (typeof result.height === 'number' && typeof result.width === 'number') {
          this.dynamicRatio = (result.height / result.width);
        }
      } catch (error) {
        if (error.body && error.body.message) {
          this.oembedError = error.body;
        } else {
          this.oembedError = { message: this.$t('apostrophe:oembedInvalidEmbedUrl') };
        }
        this.next.title = '';
        this.next.thumbnail = '';
      } finally {
        this.tempReadOnly = false;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input__embed {
    :deep(iframe) {
      max-width: 100%;
    }

    &.apos-is-dynamic {
      position: relative;
      width: 100%;
      height: 0;

      :deep(iframe) {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    }
  }
</style>

<template>
  <AposModal
    :modal="modal"
    class="apos-share-draft"
    data-apos-test="share-draft-modal"
    v-on="{ esc: close }"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-share-draft__header">
            <h2 class="apos-share-draft__heading">
              {{ $t('apostrophe:shareDraftHeader') }}
            </h2>
            <Close
              class="apos-share-draft__close"
              :title="$t('apostrophe:close')"
              :size="18"
              @click.prevent="close"
            />
          </div>
          <div class="apos-share-draft__content">
            <div class="apos-share-draft__toggle-wrapper">
              <AposToggle
                v-model="disabled"
                class="apos-share-draft__toggle"
                @toggle="toggle"
              />
              <p class="apos-share-draft__toggle-label">
                {{ $t('apostrophe:shareDraftEnable') }}
              </p>
            </div>
            <p class="apos-share-draft__description">
              {{ $t('apostrophe:shareDraftDescription') }}
            </p>
            <transition
              name="collapse"
              :duration="200"
            >
              <div
                class="apos-share-draft__url-block"
                v-show="!disabled"
              >
                <input
                  v-model="shareUrl"
                  type="text"
                  disabled
                  class="apos-share-draft__url"
                >
                <a
                  href=""
                  class="apos-share-draft__link-copy"
                  @click.prevent="copy"
                >
                  <LinkVariant
                    class="apos-share-draft__link-icon"
                    :title="$t('apostrophe:shareDraftCopyLink')"
                    :size="16"
                  />
                  &nbsp;{{ $t('apostrophe:shareDraftCopyLink') }}
                </a>
              </div>
            </transition>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import Close from 'vue-material-design-icons/Close.vue';
import LinkVariant from 'vue-material-design-icons/LinkVariant.vue';

export default {
  components: {
    Close,
    LinkVariant
  },
  props: {
    doc: {
      type: Object,
      required: true
    }
  },
  emits: [ 'safe-close' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true,
        trapFocus: true
      },
      shareUrl: '',
      disabled: true
    };
  },
  async mounted() {
    this.modal.active = true;
    await this.checkUrlProp();
    await this.getAposShareKey();
  },
  methods: {
    async copy() {
      await navigator.clipboard.writeText(this.shareUrl);
    },
    async toggle() {
      this.disabled = !this.disabled;

      await this.setShareUrl();
    },
    async setShareUrl() {
      try {
        const { aposShareKey } = await apos.http.post(
          `${apos.modules[this.doc.type].action}/${this.doc._id}/share`, {
            busy: true,
            body: {
              share: !this.disabled
            },
            draft: true
          }
        );

        if (this.disabled) {
          setTimeout(() => {
            this.shareUrl = '';
          }, 200);
          return;
        }

        if (!aposShareKey) {
          return this.showError();
        }

        this.shareUrl = this.generateShareUrl(aposShareKey);
      } catch {
        if (this.disabled) {
          this.shareUrl = '';
          return;
        }
        await this.showError();
      }
    },
    close() {
      this.modal.showModal = false;
    },
    async checkUrlProp() {
      if (!this.doc._url) {
        await this.showError();
      }
    },
    async getAposShareKey() {
      try {
        const { aposShareKey } = await apos.http.get(
          `${apos.modules[this.doc.type].action}/${this.doc._id}`, {}
        );

        if (aposShareKey) {
          this.disabled = false;
          this.shareUrl = this.generateShareUrl(aposShareKey);
        }
      } catch {
        await this.showError();
      }
    },
    async showError() {
      await apos.notify('apostrophe:shareDraftError', {
        type: 'danger',
        icon: 'alert-circle-icon',
        dismiss: true
      });
    },
    generateShareUrl(aposShareKey) {
      const regex = /^https?:\/\//;
      const docUrl = regex.test(this.doc._url)
        ? this.doc._url
        : `${location.origin}${this.doc._url}`;

      const url = new URL(docUrl);

      const urlInfo = {
        url: url.href
      };

      apos.bus.$emit('shared-draft-link', urlInfo);

      return apos.http.addQueryToUrl(urlInfo.url, {
        ...(url.search ? apos.http.parseQuery(url.search) : {}),
        aposShareKey,
        aposShareId: this.doc._id
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-share-draft {
  z-index: $z-index-modal;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

::v-deep .apos-modal__inner {
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  max-width: 700px;
  height: auto;
  border-radius: 15px;
}

::v-deep .apos-modal__overlay {
  .apos-modal + .apos-share-draft & {
    display: block;
  }
}

::v-deep .apos-modal__body {
  padding: 20px;
}

::v-deep .apos-modal__body-main {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.apos-share-draft__header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  border-bottom: 1px solid var(--a-base-8);
  padding: 0 20px 20px;
}

.apos-share-draft__heading {
  @include type-title;
  line-height: var(--a-line-tall);
  margin: 0;
}

.apos-share-draft__close {
  height: 18px;
  align-self: center;
  cursor: pointer;
}

.apos-share-draft__content {
  margin-top: $spacing-double;
}

.apos-share-draft__toggle-wrapper {
  display: flex;
  align-items: center;
}

.apos-share-draft__toggle {
  margin-right: 12px;
}

.apos-share-draft__toggle-label {
  @include type-base;
  max-width: 370px;
  line-height: var(--a-line-tallest);
  margin: 0;
}

.apos-share-draft__description {
  @include type-small;
  line-height: var(--a-line-tall);
  max-width: 355px;
  color: var(--a-base-2);
}

.apos-share-draft__url-block {
  overflow: hidden;
  height: 63px;
  transition: height 200ms linear;

  &.collapse-enter,
  &.collapse-leave-to {
    height: 0;
  }
}

.apos-share-draft__url {
  @include type-base;
  width: 100%;
  padding: 5px;
  border-radius: 5px;
  background-color: var(--a-base-9);
  border: 1px solid var(--a-base-8);
  box-sizing: border-box;
}

.apos-share-draft__link-icon {
  height: 16px;
}

.apos-share-draft__link-copy {
  @include type-base;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: $spacing-double;
  text-decoration: none;
  color: var(--a-primary);
  font-weight: var(--a-weight-bold);;
}
</style>

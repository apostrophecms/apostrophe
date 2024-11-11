<template>
  <AposModal
    :modal="modal"
    class="apos-share-draft"
    data-apos-test="share-draft-modal"
    v-on="{ esc: close }"
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
              tabindex="0"
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
                data-apos-focus-priority
                @toggle="toggle"
              />
              <p class="apos-share-draft__toggle-label" @click="toggle">
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
                v-show="!disabled"
                class="apos-share-draft__url-block"
              >
                <input
                  v-model="shareUrl"
                  type="text"
                  disabled
                  tabindex="-1"
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
import Close from '@apostrophecms/vue-material-design-icons/Close.vue';
import LinkVariant from '@apostrophecms/vue-material-design-icons/LinkVariant.vue';

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
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true
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
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  :deep(.apos-modal__inner) {
    inset: auto;
    max-width: 700px;
    height: auto;
    border-radius: 15px;
  }

  :deep(.apos-modal__overlay) {
    .apos-modal + .apos-share-draft & {
      display: block;
    }
  }

  :deep(.apos-modal__body) {
    padding: 20px;
  }

  :deep(.apos-modal__body-main) {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
}

.apos-share-draft__header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--a-base-8);
}

.apos-share-draft__heading {
  @include type-title;

  & {
    line-height: var(--a-line-tall);
    margin: 0;
  }
}

.apos-share-draft__close {
  align-self: center;
  height: 18px;
  cursor: pointer;
}

.apos-share-draft__content {
  margin-top: $spacing-double;
}

.apos-share-draft__toggle-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-base;
}

.apos-share-draft__toggle {
  margin-right: 12px;
}

.apos-share-draft__toggle-label {
  @include type-large;

  & {
    flex-grow: 1;
    max-width: 370px;
    line-height: var(--a-line-tallest);
    margin: 0;
  }

  &:hover {
    cursor: pointer;
  }
}

.apos-share-draft__description {
  @include type-base;

  & {
    line-height: var(--a-line-tall);
    max-width: 355px;
    color: var(--a-base-2);
  }
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

  & {
    box-sizing: border-box;
    width: 100%;
    padding: 5px;
    border: 1px solid var(--a-base-8);
    border-radius: 5px;
    background-color: var(--a-base-9);
  }
}

.apos-share-draft__link-icon {
  height: 16px;
}

.apos-share-draft__link-copy {
  @include type-base;

  & {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-top: $spacing-double;
    color: var(--a-primary);
    text-decoration: none;
    font-weight: var(--a-weight-bold);
  }
}
</style>

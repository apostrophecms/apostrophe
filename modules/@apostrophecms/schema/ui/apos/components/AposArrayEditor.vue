<template>
  <AposModal
    class="apos-array-editor" :modal="modal"
    :modal-title="`Edit ${field.label}`"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Exit"
        @click="cancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary" label="Save"
        :disabled="!valid"
        @click="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <div class="apos-modal-array-items">
          <p v-if="effectiveMin" :class="minError ? 'apos-modal-array-min-error' : ''">
            Minimum items: {{ effectiveMin }}
          </p>
          <p v-if="field.max" :class="maxError ? 'apos-modal-array-max-error' : ''">
            Maximum items: {{ field.max }}
          </p>
          <button :disabled="maxed || itemError" @click.prevent="add">
            Add Item
          </button>
          <ul class="apos-modal-array-items__items">
            <li
              class="apos-modal-array-items__item"
              v-for="( item, index ) in next"
              :key="item._id"
            >
              <button @click.prevent="remove(item._id)">
                ⓧ
              </button>
              <button v-if="index > 0" @click.prevent="up(item._id)">
                ⬆️
              </button>
              <button v-if="index + 1 < next.length" @click.prevent="down(item._id)">
                ⬇️
              </button>
              <button
                :disabled="itemError"
                :id="item._id" class="apos-modal-array-items__btn"
                :aria-selected="item._id === currentId ? true : false"
                @click="select(item._id)"
              >
                {{ label(item) }}
              </button>
            </li>
          </ul>
        </div>
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-modal-array-item">
            <div class="apos-modal-array-item__wrapper">
              <div class="apos-modal-array-item__pane">
                <div class="apos-array-item__body">
                  <AposSchema
                    v-if="currentId !== false"
                    :schema="field.schema"
                    :trigger-validation="triggerValidation"
                    :utility-rail="false"
                    :following-values="followingValues()"
                    v-model="currentDoc"
                    :server-errors="currentDocServerErrors"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import cuid from 'cuid';
import klona from 'klona';
import { get } from 'lodash';

export default {
  name: 'AposArrayEditor',
  mixins: [
    AposModalParentMixin,
    AposEditorMixin
  ],
  props: {
    items: {
      required: true,
      type: Array
    },
    field: {
      required: true,
      type: Object
    },
    serverError: {
      type: Object,
      default: null
    }
  },
  emits: [ 'input', 'safe-close' ],
  data() {
    return {
      currentId: false,
      currentDoc: null,
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      // If we don't clone, then we're making
      // permanent modifications whether the user
      // clicks save or not
      next: klona(this.items),
      triggerValidation: false,
      minError: false,
      maxError: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.schema || {};
    },
    itemError() {
      return this.currentDoc && this.currentDoc.hasErrors;
    },
    valid() {
      return !(this.minError || this.maxError || this.itemError);
    },
    maxed() {
      return (this.field.max !== undefined) && (this.next.length >= this.field.max);
    },
    schema() {
      // For AposDocEditorMixin
      return this.field.schema;
    },
    effectiveMin() {
      if (this.field.min) {
        return this.field.min;
      } else if (this.field.required) {
        return 1;
      } else {
        return 0;
      }
    },
    currentDocServerErrors() {
      let serverErrors = null;
      ((this.serverError && this.serverError.data && this.serverError.data.errors) || []).forEach(error => {
        const [ _id, fieldName ] = error.path.split('.');
        if (_id === this.currentId) {
          serverErrors = serverErrors || {};
          serverErrors[fieldName] = error;
        }
      });
      return serverErrors;
    }
  },
  async mounted() {
    this.modal.active = true;
  },
  methods: {
    select(_id) {
      if (this.currentId === _id) {
        return;
      }
      this.validateAndThen(true, false, () => {
        this.currentDocToCurrentItem();
        this.currentId = _id;
        this.currentDoc = {
          hasErrors: false,
          data: this.next.find(item => item._id === _id)
        };
        this.triggerValidation = false;
      });
    },
    remove(_id) {
      this.next = this.next.filter(item => !(item._id === _id));
      if (_id === this.currentId) {
        this.currentId = false;
        this.currentDoc = null;
      }
      this.updateMinMax();
    },
    up(_id) {
      const index = this.next.findIndex(item => item._id === _id);
      this.next = this.next.slice(0, index - 1).concat([ this.next[index], this.next[index - 1] ]).concat(this.next.slice(index + 1));
    },
    down(_id) {
      const index = this.next.findIndex(item => item._id === _id);
      this.next = this.next.slice(0, index).concat([ this.next[index + 1], this.next[index] ]).concat(this.next.slice(index + 2));
    },
    add() {
      this.validateAndThen(true, false, () => {
        const item = this.newInstance();
        item._id = cuid();
        this.next.push(item);
        this.select(item._id);
        this.updateMinMax();
      });
    },
    updateMinMax() {
      if (this.effectiveMin) {
        if (this.next.length < this.effectiveMin) {
          this.minError = true;
        }
      }
      if (this.field.max !== undefined) {
        if (this.next.length > this.field.max) {
          this.maxError = true;
        }
      }
    },
    submit() {
      this.validateAndThen(true, true, async () => {
        let error;
        this.updateMinMax();
        if (this.minError || this.maxError || (this.currentDoc && this.currentDoc.hasErrors)) {
          error = true;
        }
        if (error) {
          await apos.notify('Resolve errors before saving.', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          return;
        }
        this.currentDocToCurrentItem();
        this.$emit('update', this.next);
        this.modal.showModal = false;
      });
    },
    currentDocToCurrentItem() {
      if (!this.currentId) {
        return;
      }
      const currentIndex = this.next.findIndex(item => item._id === this.currentId);
      this.next[currentIndex] = this.currentDoc.data;
    },
    validateAndThen(validateItem, validateLength, then) {
      if (validateItem) {
        this.triggerValidation = true;
      }
      this.$nextTick(async () => {
        if (
          (validateLength && (this.minError || this.maxError)) ||
          (validateItem && (this.currentDoc && this.currentDoc.hasErrors))
        ) {
          await apos.notify('Resolve errors first.', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        } else {
          then();
        }
      });
    },
    newInstance() {
      const instance = {};
      for (const field of this.field.schema) {
        if (field.def !== undefined) {
          instance[field.name] = klona(field.def);
        }
      }
      return instance;
    },
    label(item) {
      let candidate;
      if (this.field.titleField) {
        candidate = get(item, this.field.titleField);
      } else if (this.field.schema.find(field => field.name === 'title') && (item.title !== undefined)) {
        candidate = item.title;
      }
      if ((candidate == null) || candidate === '') {
        for (let i = 0; (i < this.next.length); i++) {
          if (this.next[i]._id === item._id) {
            candidate = `#${i + 1}`;
            break;
          }
        }
      }
      return candidate;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-modal-array-item {
    display: flex;
    height: 100%;
  }

  .apos-modal-array-item__wrapper {
    display: flex;
    flex-grow: 1;
  }

  .apos-modal-array_item__pane {
    width: 100%;
    border-width: 0;
  }

  .apos-array-item__body {
    padding-top: 20px;
    max-width: 90%;
    margin-right: auto;
    margin-left: auto;
  }

  .apos-modal-array-min-error, .apos-modal-array-max-error {
    color: var(--a-danger);
  }
</style>

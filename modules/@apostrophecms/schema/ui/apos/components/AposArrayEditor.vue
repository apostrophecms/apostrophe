<template>
  <AposModal
    class="apos-array-editor" :modal="modal"
    :modal-title="`Edit ${field.label}`"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Cancel"
        @click="confirmAndCancel"
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
          <div class="apos-modal-array-items__heading">
            <p class="apos-modal-array-items__label">
              <span v-if="countLabel">
                {{ countLabel }}
              </span>
              <span v-if="minLabel" :class="minError ? 'apos-modal-array-min-error' : ''">
                {{ minLabel }}
              </span>
              <span v-if="maxLabel" :class="maxError ? 'apos-modal-array-max-error' : ''">
                {{ maxLabel }}
              </span>
            </p>
            <AposButton
              class="apos-modal-array-items__add"
              label="Add Item"
              :icon-only="true"
              icon="plus-icon"
              :modifiers="[ 'tiny', 'round' ]"
              :disabled="maxed || itemError"
              @click.prevent="add"
            />
          </div>
          <AposSlatList
            class="apos-modal-array-items__items"
            @input="update"
            @select="select"
            :selected="currentId"
            :value="withLabels(next)"
          />
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
                    v-if="currentId"
                    :schema="field.schema"
                    :trigger-validation="triggerValidation"
                    :utility-rail="false"
                    :following-values="followingValues()"
                    :value="currentDoc"
                    @input="currentDocUpdate"
                    :server-errors="currentDocServerErrors"
                    ref="schema"
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
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import cuid from 'cuid';
import klona from 'klona';
import { get } from 'lodash';

export default {
  name: 'AposArrayEditor',
  mixins: [
    AposModalModifiedMixin,
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
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      currentId: null,
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
      maxError: false,
      cancelDescription: 'Do you want to discard changes to this list?'
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
    countLabel() {
      return `${this.next.length} Added`;
    },
    // Here in the array editor we use effectiveMin to factor in the
    // required property because there is no other good place to do that,
    // unlike the input field wrapper which has a separate visual
    // representation of "required".
    minLabel() {
      if (this.effectiveMin) {
        return `Min: ${this.effectiveMin}`;
      } else {
        return false;
      }
    },
    maxLabel() {
      if ((typeof this.field.max) === 'number') {
        return `Max: ${this.field.max}`;
      } else {
        return false;
      }
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
    if (this.next.length) {
      this.select(this.next[0]._id);
    }
    if (this.serverError && this.serverError.data && this.serverError.data.errors) {
      const first = this.serverError.data.errors[0];
      const [ _id, name ] = first.path.split('.');
      await this.select(_id);
      const aposSchema = this.$refs.schema;
      await this.nextTick();
      aposSchema.scrollFieldIntoView(name);
    }
  },
  methods: {
    async select(_id) {
      if (this.currentId === _id) {
        return;
      }
      if (await this.validate(true, false)) {
        this.currentDocToCurrentItem();
        this.currentId = _id;
        this.currentDoc = {
          hasErrors: false,
          data: this.next.find(item => item._id === _id)
        };
        this.triggerValidation = false;
      }
    },
    update(items) {
      this.modified = true;
      // Take care to use the same items in order to avoid
      // losing too much state inside draggable, otherwise
      // drags fail
      this.next = items.map(item => this.next.find(_item => item._id === _item._id));
      if (this.currentId) {
        if (!this.next.find(item => item._id === this.currentId)) {
          this.currentId = null;
          this.currentDoc = null;
        }
      }
      this.updateMinMax();
    },
    currentDocUpdate(currentDoc) {
      this.currentDoc = currentDoc;
      this.modified = true;
    },
    async add() {
      if (await this.validate(true, false)) {
        this.modified = true;
        const item = this.newInstance();
        item._id = cuid();
        this.next.push(item);
        this.select(item._id);
        this.updateMinMax();
      }
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
    async submit() {
      if (await this.validate(true, true)) {
        this.currentDocToCurrentItem();
        this.$emit('modal-result', this.next);
        this.modal.showModal = false;
      }
    },
    currentDocToCurrentItem() {
      if (!this.currentId) {
        return;
      }
      const currentIndex = this.next.findIndex(item => item._id === this.currentId);
      this.next[currentIndex] = this.currentDoc.data;
    },
    async validate(validateItem, validateLength) {
      if (validateItem) {
        this.triggerValidation = true;
      }
      await this.nextTick();
      if (validateLength) {
        this.updateMinMax();
      }
      if (
        (validateLength && (this.minError || this.maxError)) ||
        (validateItem && (this.currentDoc && this.currentDoc.hasErrors))
      ) {
        await apos.notify('Resolve errors first.', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        return false;
      } else {
        return true;
      }
    },
    // Awaitable nextTick
    nextTick() {
      return new Promise((resolve, reject) => {
        this.$nextTick(() => {
          return resolve();
        });
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
    },
    withLabels(items) {
      const result = items.map(item => ({
        ...item,
        title: this.label(item)
      }));
      return result;
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

  .apos-modal-array-items {
    margin: 10px;
  }

  .apos-modal-array-items__heading {
    position: relative;
    margin: 20px 4px;
  }

  // Specificity needed due to AposButton rules
  .apos-modal-array-items__heading .apos-modal-array-items__add {
    position: absolute;
    top: -5px;
    right: 0;
  }

  .apos-modal-array-items__label {
    // Consistent with appearance of same information in input field
    letter-spacing: 1.5px;
    text-transform: uppercase;

    span {
      margin-right: 10px;
    }
  }
</style>

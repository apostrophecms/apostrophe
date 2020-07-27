<template>
  <AposModal
    class="apos-doc-editor" :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template #primaryControls>
      <AposButton
        type="primary" label="Save"
        @save="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          :current="currentTab" :tabs="tabs"
          @select-tab="switchPane"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <AposModalTabsBody>
            <div class="apos-doc-editor__body">
              <AposSchema
                :schema="currentFields" :doc="myDoc"
                @input="update"
              />
            </div>
          </AposModalTabsBody>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <div class="apos-doc-editor__utility">
          <AposSchema
            :schema="utility" :doc="myDoc"
            @input="update" :modifiers="['small', 'inverted']"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModalParentMixin
  ],
  props: {
    typeLabel: {
      type: String,
      required: true
    },
    doc: {
      type: Object,
      required: true
    },
    schema: {
      type: Array,
      required: true
    },
    groups: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: ['save', 'safe-close'],
  data() {
    const tabs = [];
    for (const key in this.groups) {
      if (key !== 'utility') {
        const temp = { ...this.groups[key] };
        temp.name = key;
        tabs.push(temp);
      }
    };

    const utility = [];
    if (this.groups.utility && this.groups.utility.fields) {
      this.groups.utility.fields.forEach((field) => {
        utility.push(this.schema.find(item => item.name === field));
      });
    }

    return {
      utility,
      tabs,
      myDoc: { ...this.doc },
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      }
    };
  },

  computed: {
    modalTitle () {
      return `Edit ${this.typeLabel}`;
    },
    currentFields: function() {
      const fields = [];
      if (this.currentTab) {
        const tabFields = this.tabs.find((item) => item.name === this.currentTab);
        tabFields.fields.forEach((field) => {
          fields.push(this.schema.find(item => field === item.name));
        });
      }
      return fields;
    }
  },
  async mounted() {
    // TODO: Get data here.
    this.modal.active = true;
  },
  methods: {
    update(name, value) {
      this.myDoc[name] = value.data;
    },
    submit() {
      this.$emit('save', this.myDoc);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-doc-editor__body {
    padding-top: 20px;
    max-width: 90%;
    margin-right: auto;
    margin-left: auto;
  }

  .apos-doc-editor__utility {
    padding: 40px 20px;
  }
</style>

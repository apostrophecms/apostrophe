<!--
  AposMediaManager will be in charge of all media-related state logic
  this includes doing the selecting and deselecting of items, deciding the editor/selection view,
  emitting batch action events, etc. All sub views will recieve `media` as a prop
-->

<template>
  <AposModal
    :modal="modal" modal-title="Manage Media"
    class="apos-media-manager"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template #primaryControls>
      <AposButton
        type="default" label="Finished"
        @click="cancel"
      />
    </template>
    <template #leftRail v-if="!!media.length">
      <AposModalRail>
        <AposTagList title="Filter by Tag" :tags="tagList" />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader v-if="!!media.length">
          <AposMediaManagerToolbar
            :checked="checked" :media="media"
            @select-click="selectClick"
            @trash-click="trashClick"
            @search="search"
          />
        </template>
        <template #bodyMain>
          <AposMediaManagerDisplay
            v-if="!!media.length"
            :media="media" ref="display"
            @edit="updateEditing"
            v-model="checked"
            @select="select"
            @select-series="selectSeries"
            @select-another="selectAnother"
          />
          <div v-else class="apos-media-manager__empty">
            <AposEmptyState :empty-state="emptyDisplay" />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail v-if="!!media.length">
      <AposModalRail type="right">
        <div
          class="apos-media-manager__sidebar"
          :class="{ 'apos-media-manager__sidebar--empty' : !checked.length }"
        >
          <AposMediaManagerEditor
            v-show="editing"
            :media="editing" :selected="selected"
            @back="updateEditing(null)" @save="saveMedia"
          />
          <AposMediaManagerSelections
            :items="selected"
            @clear="clearSelected" @edit="updateEditing"
            v-show="!editing"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
// TODO: Set up Storybook story for this component
import AposModalParentMixin from '../../../../modals/src/apos/mixins/AposModalParentMixin';

export default {
  mixins: [AposModalParentMixin],
  props: {
    media: {
      type: Array,
      required: true
    },
    tagList: {
      type: Array,
      default() {
        return [];
      }
    },
    applyTags: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  emits: ['safe-close', 'trash', 'save', 'search'],
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      editing: null,
      checked: [],
      lastSelected: null,
      emptyDisplay: {
        title: 'No Media Found',
        message: 'Uploaded media will appear here',
        emoji: '🖼'
      }
    };
  },
  computed: {
    selected() {
      return this.media.filter(item => this.checked.includes(item.id));
    }
  },
  watch: {
    checked (newVal) {
      if (newVal.length > 1) {
        this.editing = null;
      }
    }
  },
  async mounted() {
    // TODO: Get data here.
    this.modal.active = true;
  },
  methods: {
    clearSelected() {
      this.checked = [];
      this.editing = null;
    },
    updateEditing(id) {
      this.editing = this.media.find(item => item.id === id);
    },

    // select setters
    select(id) {
      if (this.checked.includes(id)) {
        this.checked = [];
      } else {
        this.checked = [id];
      }

      this.updateEditing(id);
      this.lastSelected = id;
    },

    selectAnother(id) {
      if (this.checked.includes(id)) {
        this.checked = this.checked.filter(checkedId => checkedId !== id);
      } else {
        this.checked.push(id);
      }

      this.lastSelected = id;
      this.editing = null;
    },

    selectSeries(id) {
      if (!this.lastSelected) {
        this.select(id);
        return;
      }

      let beginIndex = this.media.findIndex(item => item.id === this.lastSelected);
      let endIndex = this.media.findIndex(item => item.id === id);
      const direction = beginIndex > endIndex ? -1 : 1;

      if (direction < 0) {
        [beginIndex, endIndex] = [endIndex, beginIndex];
      } else {
        endIndex++;
      }

      const sliced = this.media.slice(beginIndex, endIndex);
      // always want to check, never toggle
      sliced.forEach(item => {
        if (!this.checked.includes(item.id)) {
          this.checked.push(item.id);
        }
      });

      this.lastSelected = sliced[sliced.length - 1].id;
      this.editing = null;
    },

    // Toolbar handlers
    selectClick() {
      if (this.checked.length === this.media.length) {
        // unselect all
        this.clearSelected();
      } else {
        // select all
        this.checked = this.media.map(item => item.id);
        this.editing = null;
        this.lastSelected = this.media[this.media.length - 1].id;
      }
    },

    // TODO stub
    trashClick() {
      this.$emit('trash', this.checked);
    },

    // TODO stub
    saveMedia() {
      this.$emit('save');
    },

    search(query) {
      // TODO stub
      this.$emit('search', query);
    }

  }
};
</script>

<style lang="scss" scoped>
.apos-media-manager /deep/ .apos-media-manager-toolbar {
  z-index: $z-index-manager-toolbar;
  position: relative;
}

.apos-media-manager__empty {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  margin-top: 130px;
}

.apos-media-manager__sidebar {
  position: relative;
  width: 100%;
}

.apos-media-manager__sidebar--empty {
  height: 100%;
}

</style>

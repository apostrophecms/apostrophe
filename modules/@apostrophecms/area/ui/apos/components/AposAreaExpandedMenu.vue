<template>
  <AposModal
    class="apos-area-menu--expanded"
    :modal="modal"
    modal-title="apostrophe:addContent"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div
            v-for="(group, groupIndex) in groups"
            :key="groupIndex"
            class="apos-widget-group"
          >
            <h2 v-if="group.label" class="apos-widget-group__label">{{ $t(group.label) }}</h2>
            <div
              :class="[
                `apos-widget-group--${group.columns}-column${
                  group.columns > 1 ? 's' : ''
                }`
              ]"
            >
              <button
                v-for="(item, itemIndex) in group.widgets"
                :key="itemIndex"
                :data-apos-focus-priority="itemIndex === 0 ? true : null"
                class="apos-widget"
                @click="add(item)"
              >
                <div class="apos-widget__preview">
                  <plus-icon
                    :size="20"
                    class="apos-icon--add"
                  />
                  <img
                    v-if="item.previewUrl"
                    :src="item.previewUrl"
                    :alt="`${item.name} preview`"
                    class="apos-widget__preview-image"
                  >
                  <component
                    :is="getIcon(item)"
                    v-else-if="hasIcon(item)"
                    :title="getTitle(item)"
                    :size="25"
                    class="apos-widget__preview--icon"
                  />
                </div>
                <p class="apos-widget__label">
                  {{ $t(item.label) }}
                </p>
                <p v-if="item.description" class="apos-widget__help">
                  {{ $t(item.description) }}
                </p>
              </button>
            </div>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  name: 'AposAreaExpandedMenu',
  props: {
    options: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  emits: [ 'expanded-menu-close', 'modal-result' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'slide',
        origin: 'left',
        showModal: false,
        width: 'one-third'
      },
      groups: []
    };
  },
  async mounted() {
    this.modal.active = true;

    if (this.options.groups) {
      for (const item of Object.keys(this.options.groups)) {
        if (!this.isValidColumn(item.columns)) {
          console.warn(
            `apos.expanded-menu: The specified number of columns for the group ${item.label} is not between the allowed range of 1-4.`
          );
        }

        const group = this.createGroup(this.options.groups[item]);
        this.groups.push(group);
      }
    } else if (this.options.widgets) {
      if (!this.isValidColumn(this.options.columns)) {
        console.warn(
          'apos.expanded-menu: The specified number of columns for the area is not between the allowed range of 1-4.'
        );
      }

      const group = this.createGroup(this.options);
      this.groups.push(group);
    } else {
      console.warn(
        'apos.expanded-menu: No groups or widgets defined. Please, either add a groups or widgets property to your area configuration.'
      );
    }

    const clipboard = this.getClipboard();
    this.groups = clipboard
      ? [ clipboard ].concat(this.groups)
      : this.groups;
  },
  methods: {
    isValidColumn(count) {
      return count ? +count > 1 && +count < 4 : true;
    },
    getClipboard() {
      const clipboard = apos.area.widgetClipboard.get();
      if (!clipboard) {
        return null;
      }

      const widgets = this.groups.flatMap(group => Object.values(group.widgets));
      const matchingChoice = widgets.find(widget => widget.name === clipboard.type);
      if (!matchingChoice) {
        return null;
      }

      const group = {
        label: this.$t('apostrophe:areaExpandedMenuClipboard'),
        widgets: [
          {
            type: 'clipboard',
            ...matchingChoice,
            label: {
              key: 'apostrophe:pasteWidget',
              widget: this.$t(matchingChoice.label)
            },
            clipboard
          }
        ],
        columns: 1
      };

      return group;
    },
    createGroup(config) {
      const group = {
        columns: +config.columns || 3,
        widgets: []
      };

      if (config.label) {
        group.label = config.label;
      }

      for (const item of Object.keys(config.widgets)) {
        group.widgets.push(apos.modules[`${item}-widget`]);
      }

      return group;
    },
    getIcon(widget) {
      return widget.previewIcon || widget.icon;
    },
    hasIcon(widget) {
      return Boolean(widget.previewIcon || widget.icon);
    },
    getTitle(widget) {
      const icon = this.getIcon(widget);
      return icon.replaceAll('-', ' ');
    },
    close() {
      this.modal.showModal = false;
    },
    async add(item) {
      const data = {
        ...item,
        index: this.index
      };
      this.$emit('modal-result', data);
      this.modal.showModal = false;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-area-menu--expanded {
  @include type-base;
}

.apos-widget-group {
  &:not(:last-of-type) {
    margin-bottom: 20px;
  }

  .apos-widget__preview {
    position: relative;
    display: flex;
    overflow: hidden;
    align-items: center;
    justify-content: center;
    height: 135px;
    outline: 1px solid var(--a-base-7);
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-10);
  }

  &--1-column {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
  }

  &--2-columns {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  &--3-columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px 10px;

    .apos-widget__preview {
      height: 89px;
    }
  }

  &--4-columns {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px 5px;

    .apos-widget__preview {
      height: 66px;
    }
  }
}

.apos-widget {
  @include type-base;

  & {
    padding: 0;
    border: none;
    border-radius: var(--a-border-radius);
    background: none;
    text-align: inherit;
  }

  .apos-widget__preview {
    transition: opacity 250ms ease-in-out;

    .apos-icon--add {
      z-index: $z-index-default;
      position: absolute;
      // Center the child content
      display: flex;
      align-items: center;
      // Center in the parent element
      place-self: center center;
      justify-content: center;
      width: 27px;
      height: 27px;
      color: var(--a-white);
      border-radius: 50%;
      background-color: var(--a-primary);
      opacity: 0;
    }

    &::after {
      position: absolute;
      width: 100%;
      height: 100%;
      transition: all 250ms ease-in-out;
      content: '';
      background-color: var(--a-primary);
      opacity: 0;
    }
  }

  &:focus,
  &:active {
    outline: 2px solid var(--a-primary-light-40);
    outline-offset: 4px;
  }

  &:hover {
    cursor: pointer;
    // stylelint-disable max-nesting-depth
    .apos-widget__preview {
      .apos-icon--add {
        opacity: 1;
      }

      &::after {
        opacity: 0.4;
      }
    }
    // stylelint-enable max-nesting-depth
  }
}

.apos-widget__preview-image {
  width: 100%;
}

.apos-widget-group__label,
.apos-widget__help {
  @include type-base;

  & {
    margin-top: 0;
    line-height: var(--a-line-tall);
    text-align: left;
  }
}

.apos-widget__help {
  color: var(--a-base-2);
  font-size: var(--a-type-smaller);
}

.apos-widget__label {
  line-height: 1.2;
  margin-bottom: 5px;
}
</style>

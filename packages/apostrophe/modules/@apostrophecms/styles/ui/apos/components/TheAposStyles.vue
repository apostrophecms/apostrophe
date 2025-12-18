<template>
  <transition name="fade">
    <div
      v-if="ready"
      v-show="isOpen"
      ref="styles"
      class="apos-styles"
      :style="style"
      :class="modifiers"
    >
      <div
        class="apos-styles__top"
        @mousedown="startDragging"
      >
        <div class="apos-styles__header">
          <div class="apos-styles__header-title-container">
            <TransitionGroup name="btnfade">
              <button
                v-if="currentPath.length"
                key="btn"
                class="apos-styles__header-navigate-btn"
                @mousedown.stop=""
                @click="navigateLeft"
              >
                <AposIndicator
                  icon="chevron-left-icon"
                  class="apos-styles__header-navigate-icon"
                  :icon-size="20"
                />
              </button>
              <span
                key="title"
                class="apos-styles__header-title"
              >
                {{ stylesTitle }}
              </span>
            </TransitionGroup>
          </div>
          <AposDocContextMenu
            :doc="docFields.data"
            :show-edit="false"
          />
        </div>
      </div>
      <div
        ref="stylesBody"
        class="apos-styles__body"
        @mousedown="startDragging"
      >
        <Transition name="slide">
          <AposStylesBody
            v-if="current"
            :key="current.label"
            :class="{'apos-styles__body--slide-back': slideBack}"
            :current="current"
            :current-path="currentPath"
            :field-value="fieldValue"
            :inline-value="inlineValue"
            @update-data="updateDocFields($event)"
            @navigate-right="navigateRight"
          />
        </Transition>
      </div>
      <div class="apos-styles__controls">
        <AposButton
          class="apos-styles__cancel"
          label="apostrophe:cancel"
          @click="cancel"
        />
        <AposButton
          type="primary"
          label="apostrophe:stylesUpdate"
          @click="save"
        />
      </div>
    </div>
  </transition>
</template>

<script>
// FIXME: move universal/check-if-conditions.mjs to the schema ui/apos folder.
// Keep the old import, but re-export from the schema ui/apos folder
// for backwards compatibility.
// Replace all UI imports in the codebase to import from the schema ui/apos folder
// via alias `Modules/@apostrophecms/ui/schema/universal/check-if-conditions.mjs`.
// Replace the backend imports to import
// from `../path-to/@apostrophecms/ui/apos/schema/universal/check-if-conditions.mjs`.
import checkIfConditions from 'apostrophe/lib/universal/check-if-conditions.mjs';
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';
import renderCss from 'Modules/@apostrophecms/styles/universal/render.mjs';
import { klona } from 'klona';
import postcss from 'postcss';
import postcssPlugin from 'postcss-viewport-to-container-toggle';

export default {
  name: 'TheAposStyles',
  mixins: [ AposThemeMixin ],
  data() {
    const moduleOptions = apos.modules['@apostrophecms/styles'];
    const groups = moduleOptions.groups ? klona(moduleOptions.groups) : {};

    return {
      ready: false,
      schema: moduleOptions.schema,
      groups,
      action: moduleOptions.action,
      moduleOptions,
      isOpen: false,
      currentPath: [],
      current: null,
      docFields: {
        hasErrors: false,
        data: {}
      },
      dragging: false,
      position: {
        left: 0,
        top: 0
      },
      size: {
        height: 0,
        width: 340
      },
      offset: {
        x: 0,
        y: 0
      },
      slideBack: false,
      bodyAttr: 'data-apos-body-styles-classes'
    };
  },
  computed: {
    stylesTitle() {
      if (this.currentPath.length < 2) {
        return this.$t('apostrophe:stylesSiteDesign');
      }
      const previousPath = this.currentPath.slice(0, -1);
      const previousGroup = this.getGroup(previousPath);

      return this.$t(previousGroup.label);
    },
    fieldValue() {
      return this.getSchemaData(this.current.schema);
    },
    inlineValue() {
      if (!this.current.inlineGroup) {
        return null;
      }
      return Object.entries(this.current.inlineGroup)
        .reduce((acc, [ name, { schema } ]) => {
          return {
            ...acc,
            [name]: this.getSchemaData(schema)
          };
        }, {});
    },
    modifiers() {
      return [
        ...this.themeClass,
        ...this.isOpen ? [ 'apos-styles--open' ] : [],
        ...this.dragging ? [ 'apos-styles--dragging' ] : []
      ];
    },
    style() {
      return {
        left: `${this.position.left}px`,
        top: `${this.position.top}px`,
        width: `${this.size.width}px`,
        height: `${this.size.height}px`
      };
    }
  },
  watch: {
    currentPath: {
      handler(path) {
        this.setCurrent(path);
      },
      deep: true,
      immediate: true
    }
  },
  async mounted() {
    await this.load();
    this.prepareBodyClasses();

    apos.bus.$on('admin-menu-height-changed', this.setPosition);
    apos.bus.$on('admin-menu-click', async (itemName) => {
      if (itemName === '@apostrophecms/styles' && !this.isOpen) {
        this.toggleOpen();
      }
    });

    apos.bus.$on('reset-styles-position', () => {
      if (this.isOpen) {
        this.resetPosition();
      }
    });

    apos.bus.$on('content-changed', async e => {
      if (e.doc && e.doc.type === this.docFields.data.type) {
        await this.get();
        await this.render();
      }
    });

    apos.bus.$on('refreshed', async () => {
      await this.load();
    });
  },
  methods: {
    setCurrent(currentPath) {
      const currentGroup = this.getGroup(currentPath);

      if (!currentPath.length) {
        this.current = {
          schema: [],
          subGroup: currentGroup
        };
        return;
      }

      const { inlineGroup, subGroup } = this.splitGroups(currentGroup?.group);
      this.current = {
        ...currentGroup,
        schema: this.getGroupSchema(currentGroup),
        inlineGroup,
        subGroup
      };
    },
    getGroup(path) {
      return path.reduce((group, path) => group[path] || group.group[path], this.groups);
    },
    splitGroups(groups = {}) {
      return Object.entries(groups).reduce((acc, [ name, group ]) => {
        if (group.inline) {
          acc.inlineGroup[name] = {
            ...group,
            schema: this.getGroupSchema(group)
          };
        } else {
          acc.subGroup[name] = group;
        }

        return acc;
      }, {
        subGroup: {},
        inlineGroup: {}
      });
    },
    async navigateLeft() {
      this.$refs.stylesBody.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      this.slideBack = true;
      await this.$nextTick();
      this.currentPath.pop();
    },
    async navigateRight(name) {
      this.$refs.stylesBody.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      this.slideBack = false;
      await this.$nextTick();
      this.currentPath.push(name);
    },
    startDragging({ clientX, clientY }) {
      this.dragging = true;
      this.offset.x = clientX - this.position.left;
      this.offset.y = clientY - this.position.top;

      document.body.classList.add('apos-styles-is-dragging');

      addEventListener('mousemove', this.drag);
      addEventListener('mouseup', this.stopDragging);
    },
    stopDragging() {
      this.dragging = false;

      document.body.classList.remove('apos-styles-is-dragging');
      // This will remove any selections made during dragging
      document.getSelection().removeAllRanges();

      localStorage.setItem('aposStylesPosition', JSON.stringify(this.position));

      removeEventListener('mousemove', this.drag);
      removeEventListener('mouseup', this.stopDragging);
    },
    drag({ clientX, clientY }) {
      const x = this.getAxisPos('x', clientX - this.offset.x);
      const y = this.getAxisPos('y', clientY - this.offset.y);

      this.position.left = x;
      this.position.top = y;
    },
    getAxisPos(axis, value) {
      if (value < 0) {
        return 0;
      }
      const containerSize = axis === 'x' ? window.innerWidth : window.innerHeight;
      const stylesOffset = axis === 'x' ? this.size.width : this.size.height;

      if ((value + stylesOffset) > containerSize) {
        return containerSize - stylesOffset;
      }
      return value;
    },
    async load() {
      await this.get();
      this.setPosition();
      this.ready = true;
      await this.render();
    },
    toggleOpen() {
      document.body.classList.toggle('apos-styles-is-open');
      this.isOpen = !this.isOpen;
      // To remove when we support confirmation modal
      const adminBarIcon = document.querySelector('[data-apos-test="@apostrophecms/stylesTrigger"] button');

      if (this.isOpen) {
        if (adminBarIcon) {
          adminBarIcon.setAttribute('disabled', '');
        }
        this.setPosition();
        addEventListener('resize', this.positionOnResize);
      } else {
        if (adminBarIcon) {
          adminBarIcon.removeAttribute('disabled', '');
        }
        removeEventListener('resize', this.positionOnResize);
      }
    },
    positionOnResize() {
      const x = this.getAxisPos('x', this.position.left);
      const y = this.getAxisPos('y', this.position.top);

      this.resetSize();
      if (x !== this.position.left) {
        this.position.left = x;
      }
      if (y !== this.position.top) {
        this.position.top = y;
      }

    },
    async get() {
      // Fetch styles doc from the REST API
      try {
        const response = await apos.http.get(this.action, {
          busy: false,
          draft: true
        });
        const data = response.results[0] || {};

        this.docFields.data = data;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    },
    // Execute once, on mounting, to assign the current computed classes
    // to a body data attribute for later processing.
    prepareBodyClasses() {
      if (Object.keys(this.docFields.data).length === 0) {
        return;
      }
      const { classes } = renderCss(this.schema, this.docFields.data, {
        checkIfConditionsFn: checkIfConditions
      });
      document.body.setAttribute(this.bodyAttr, classes.join(' '));
    },
    fillGroupData(group) {
      const schema = this.getGroupSchema(group);
      return {
        ...group,
        schema,
        value: this.getSchemaData(schema)
      };
    },
    getGroupSchema(group) {
      return group.fields
        ? this.schema.filter(field => group.fields.includes(field.name))
        : [];
    },
    getSchemaData(schema) {
      const data = schema.reduce((acc, field) => {
        acc[field.name] = this.docFields.data[field.name];
        return acc;
      }, {});

      return {
        hasErrors: false,
        data
      };
    },
    async updateDocFields(value) {
      // Not handled?
      if (value.hasErrors) {
        return;
      }
      this.docFields.data = {
        ...this.docFields.data,
        ...value.data
      };
      await this.render();
    },
    // Render the current data by updating the stylesheet
    async render() {
      if (this.moduleOptions.serverRendered) {
        // Intentionally call an async function without await,
        // let it handle debouncing etc. on its own
        this.renderServerSide();
      } else {
        this.renderBrowserSide();
      }
      // Server side rendering waits for emit, to leverage the debouncing done there
    },
    async renderServerSide() {
      if (this.ssrBusy) {
        this.ssrPending = true;
        return;
      }
      if (this.ssrTimeout) {
        clearTimeout(this.ssrTimeout);
      }
      this.ssrTimeout = setTimeout(async () => {
        this.ssrTimeout = null;
        this.ssrBusy = true;
        try {
          const { css, classes } = await apos.http.post(`${this.moduleOptions.action}/render`, {
            body: {
              data: this.docFields.data
            }
          });
          await this.setStyleMarkup({
            css,
            classes
          });
        } finally {
          this.ssrBusy = false;
          if (this.ssrPending) {
            this.ssrPending = false;
            this.renderServerSide();
          }
        }
      }, 500);
    },
    async renderBrowserSide() {
      await this.setStyleMarkup(
        renderCss(this.schema, this.docFields.data, {
          checkIfConditionsFn: checkIfConditions
        })
      );
    },
    async setStyleMarkup({ css, classes }) {
      this.setBodyClasses(classes);
      if (apos.adminBar.breakpointPreviewMode?.enable) {
        const processed = await postcss([
          postcssPlugin({
            modifierAttr: 'data-breakpoint-preview-mode',
            debug: apos.adminBar.breakpointPreviewMode?.debug === true,
            transform: apos.adminBar.breakpointPreviewMode?.transform || null
          })
        ])
          .process(css, {
            from: undefined,
            to: undefined
          });
        document.querySelector('#apos-styles-stylesheet').innerHTML = processed.css;
        return;
      }

      document.querySelector('#apos-styles-stylesheet').innerHTML = css;
    },
    setBodyClasses(classes) {
      const previousClasses = document.body
        .getAttribute(this.bodyAttr)
        ?.split(' ')
        .filter((cls) => cls.length) || [];
      if (previousClasses.length) {
        document.body.classList.remove(...previousClasses);
      }
      if (classes.length) {
        document.body.classList.add(...classes);
      }
      document.body.setAttribute(this.bodyAttr, classes.join(' '));
    },
    resetPosition() {
      localStorage.removeItem('aposStylesPosition');
      const adminBarHeight = window.apos.adminBar.height;
      const windowSize = window.innerWidth;
      const spacing = 30;

      this.position.left = windowSize - this.size.width - spacing;
      this.position.top = adminBarHeight + spacing;
    },
    resetSize() {
      const adminBarHeight = window.apos.adminBar.height;
      const height = (window.innerHeight - adminBarHeight) * 0.8;

      this.size.height = height;
    },
    setPosition() {
      const storedPosition = localStorage.getItem('aposStylesPosition');

      this.resetSize();
      if (!storedPosition) {
        this.resetPosition();
        return;
      }

      const { left, top } = JSON.parse(storedPosition);
      if ([ left, top ].some((num) => typeof num !== 'number')) {
        this.resetPosition();
        return;
      }

      // Prevent styles from appearing out of the window
      this.position.left = this.getAxisPos('x', left);
      this.position.top = this.getAxisPos('y', top);
    },
    async save() {
      try {
        const route = `${this.moduleOptions.action}/${this.docFields.data._id}`;
        const updatedDoc = await apos.http.put(route, {
          body: this.docFields.data
        });
        this.docFields.data = updatedDoc;
        this.toggleOpen();
        setTimeout(() => {
          this.currentPath = [];
        }, 300);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    },
    async cancel() {
      await this.get();
      await this.render();
      this.toggleOpen();
      setTimeout(() => {
        this.currentPath = [];
      }, 300);
    }
  }
};

</script>

<style>
  .apos-styles-is-open {
    [data-apos-refreshable]::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--a-background-primary);
      opacity: 0;
      pointer-events: none;
      transition: opacity 200ms ease, filter 200ms ease;
    }
  }

  .apos-styles-is-dragging {
    [data-apos-refreshable] {
      filter: blur(2px);
    }

    [data-apos-refreshable]::after {
      opacity: 0.3;
    }

    & *::selection {
      background-color: transparent;
    }
  }
</style>

<style lang="scss" scoped>
$padding-unit: 10px;
$width: 360px;
$duration: 0.2s;
$timing: cubic-bezier(.175,.885,.32,1.15);
$slide-duration: 250ms;
$slide-timing: cubic-bezier(0.45, 0, 0.55, 1);

.apos-styles {
  @include type-base;

  & {
    z-index: $z-index-modal;
    position: fixed;
    display: flex;
    box-sizing: border-box;
    flex-direction: column;
    width: $width;
    border: 1px solid var(--a-base-9);
    transition:
      opacity $duration $timing,
      transform $duration $timing;
    box-shadow: var(--a-box-shadow);
    border-radius: 10px;
    background-color: var(--a-background-primary);
  }

  &--dragging {
    .apos-styles__top,
    .apos-styles__body {
      cursor: grabbing;
    }
  }
}

.apos-styles__top {
  display: flex;
  flex-direction: column;
  padding: 20px 20px 0;
  cursor: grab;
}

.apos-styles__body {
  position: relative;
  overflow: hidden scroll;
  flex: 1;
  padding: 0 20px;
  cursor: grab;
}

.apos-styles__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20px;
  column-gap: 10px;
  cursor: auto;
}

.apos-styles__header-title {
  position: relative;
}

.apos-styles__header-title-container {
  display: flex;
  align-items: center;
}

.apos-styles__header-navigate-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  border: none;
  background-color: transparent;
  cursor: pointer;
}

.apos-styles__header-navigate-icon {
  position: relative;
  left: -5px;
}

.fade-enter-active, .fade-leave-active {
  opacity: 1;
  transform: scale(1) translateZ(0);
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: scale(0.98) translateZ(-10px);
}

.apos-styles__controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: $padding-unit;
  border-top: 1px solid var(--a-base-9);
}

.slide-enter-active,
.slide-leave-active {
  transition: all $slide-duration $slide-timing;
}

.slide-enter-to,
.slide-leave-from {
  transform: translateX(0) scale(1);
  opacity: 1;
}

.slide-enter-from {
  transform: translateX(calc(100% + 15px)) scale(0.98);
  opacity: 0;

  &.apos-styles__body--slide-back {
    transform: translateX(calc(-100% - 15px)) scale(1);
    opacity: 1;
  }
}

.slide-leave-to {
  transform: translateX(calc(-100% - 15px)) scale(0.98);
  opacity: 0;

  &.apos-styles__body--slide-back {
    transform: translateX(calc(100% + 15px)) scale(0.98);
    opacity: 0;
  }
}

.slide-leave-active {
  position: absolute;
  width: 100%;
}

.slide-enter-active {
  position: relative;
}

/* Modal title animation */
.btnfade-enter-active,
.btnfade-leave-active {
  transition: all $slide-duration $slide-timing;
}

.btnfade-enter-active + .apos-styles__header-title {
  position: absolute;
  transition: all $slide-duration $slide-timing;
  transform: translateX(20px);
}

.btnfade-leave-to + .apos-styles__header-title {
  transition: all $slide-duration $slide-timing;
  transform: translateX(-20px)
}

.btnfade-enter-from,
.btnfade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>

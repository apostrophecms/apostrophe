<template>
  <AposModal
    :modal="modal"
    class="apos-command-menu-shortcut"
    @esc="close"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <header class="apos-modal__header">
            <div class="apos-modal__header__main">
              <AposButton
                type="default"
                :title="$t('apostrophe:commandMenuEsc')"
                :icon-only="true"
                icon="keyboard-esc"
                @click="close"
              />
              <h2 class="apos-modal__heading">
                {{ $t('apostrophe:commandMenuShortcut') }}
              </h2>
            </div>
          </header>
          <section class="apos-command-menu-shortcut-groups">
            <div
              v-for="(group, groupName) in groups"
              :key="groupName"
              class="apos-command-menu-shortcut-group"
            >
              <div
                v-if="groupName !== '@apostrophecms/command-menu:manager'"
              >
                <!-- TODO remove condition -->
                <h3 class="apos-command-menu-shortcut-group-title">
                  {{ $t(group.label) }}
                </h3>
                <div
                  v-for="(command, commandName) in group.fields"
                  :key="commandName"
                  class="apos-command-menu-shortcut-command"
                >
                  <div class="apos-command-menu-shortcut-command-title">{{ $t(command.label) }}</div>
                  <AposCommandMenuKeyList :shortcut="command.shortcut" />
                </div>
              </div>
            </div>
          </section>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin'; // TODO keep?

export default {
  name: 'AposCommandMenuShortcut',
  mixins: [ AposThemeMixin ], // TODO keep?
  props: {
    commands: { // TODO keep?
      type: Array,
      default: function () {
        return [];
      }
    }
  },
  emits: [ 'safe-close' ], // TODO keep?
  data() {
    return {
      groups: apos.commandMenu.groups,
      modal: {
        busy: false,
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true
      }
    };
  },
  async mounted() {
    this.modal.active = true; // TODO keep?
    // document.addEventListener('keyup', function(evt) {
    //   if (evt.keyCode === 67) {
    //     alert('yeah!');
    //   }
    // });
    if (apos.modal.stack) {
      const [ , topModal = {} ] = apos.modal.stack || [];
      // alert(`${topModal}, ${topModal.componentName}, ${topModal.props?.moduleName}`);
      console.log(topModal);
    }

    // await open(); // TODO keep?
  },
  methods: {
    close() {
      this.modal.showModal = false;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-command-menu-shortcut {
  // z-index: $z-index-modal;
  // position: fixed;
  // top: 0;
  // right: 0;
  // bottom: 0;
  // left: 0;
  // display: flex;
  // align-items: center;
  // justify-content: center;
}

::v-deep .apos-modal__body {
  padding: 0;
}

::v-deep .apos-modal__inner {
  top: auto;
  left: auto;
  max-width: 700px;
  height: auto;
  border-radius: $spacing-base + $spacing-half;
}

::v-deep .apos-modal__overlay {
  display: none;

  // .apos-modal + .apos-share-draft & {
  //   display: block;
  // }
}

.apos-modal__header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  // @include type-large;
  border-bottom: 1px solid var(--a-base-8);
  padding: $spacing-base + $spacing-half 0;

  .apos-modal__header__main {
    width: 100%;
    padding: 0 $spacing-base + $spacing-half;
  }

  ::v-deep .apos-button {
    padding: 3px $spacing-half;
    border-radius: 3px;
    border-color: #C8C7C0;
    border-bottom: 2px solid #C8C7C0;
    box-sizing: border-box;
    width: auto;
    height: $spacing-double;
    margin-right: $spacing-base;
    vertical-align: bottom;
  }
}
.apos-modal__heading {
  margin: 0;
  display: inline-block;
  @include type-base;
  font-size: 18px;
  line-height: $spacing-double;

  // title
  // color: rgba(11,11,11,1);
  // font-family: "SFProDisplay-Medium";
  // font-weight: 500;
  // font-style: normal;
  // letter-spacing: 0.82px;
}

.apos-command-menu-key {
  // // key
  // width: $spacing-double;
  // height: $spacing-double;
  // border-radius: 3px;
  // border: 0.5px solid rgba(200,199,192, 1);
  // background: linear-gradient(180deg, rgba(247, 247, 245, 1) 0%, rgba(235, 235, 232, 1) 100%);
  // margin-right: 5px;

  // // key-text
  // color: rgba(50,50,50,1);
  // // font-family: "SFProText-Medium";
  // font-size: 12px;
  // font-weight: 500;
  // font-style: normal;
  // letter-spacing: 0.43px;
  ::v-deep button {
    padding: 3px $spacing-half;
    border-radius: 3px;
    border-color: #C8C7C0;
    border-bottom: 2px solid #C8C7C0;
    box-sizing: border-box;
    width: $spacing-double;
    height: $spacing-double;
    // margin-right: $spacing-base;
    margin-left: $spacing-half;
    // vertical-align: bottom;
  }
}

.apos-command-menu-shortcut-groups {
  padding: $spacing-base $spacing-double $spacing-base + $spacing-half;
}
.apos-command-menu-shortcut-group + .apos-command-menu-shortcut-group {
  padding-top: $spacing-base + $spacing-half;
}
.apos-command-menu-shortcut-group {
  @include type-base;
}
.apos-command-menu-shortcut-group-title {
  @include type-base;
  color: var(--a-base-3);
  text-align: left;
  padding: 0;
  margin: 0;
  height: 24px;
  box-sizing: border-box;
  padding: $spacing-half 0;

  // opacity: 1;
  // color: rgba(118,118,118,1);
  // font-family: "SFPro-Semibold";
  // font-size: 12px;
  // font-weight: 600;
  // font-style: normal;
  // letter-spacing: 0.25px;
  // text-align: left;
}
.apos-command-menu-shortcut-command {
  // block
  // background-color: rgba(255,255,255, 1);
  box-sizing: border-box;
  height: 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  // @include type-large;
  padding: $spacing-half 0;

  // text
  // color: rgba(50,50,50,1);
  // font-family: "SFProText-Medium";
  // font-size: 12px;
  // font-weight: 500;
  // font-style: normal;
  // letter-spacing: 0px;

  // key
  // border-radius: 3px;
  // border: 0.5px solid rgba(200,199,192, 1);
  // background: linear-gradient(180deg, rgba(247, 247, 245, 1) 0%, rgba(235, 235, 232, 1) 100%);
  // margin-right: 5px;

  // key-text
  // color: rgba(50,50,50,1);
  // font-family: "SFProText-Medium";
  // font-size: 12px;
  // font-weight: 500;
  // font-style: normal;
  // letter-spacing: 0.43px;
}
.apos-command-menu-shortcut-command-title {
  flex: 1 1 auto;
}

</style>

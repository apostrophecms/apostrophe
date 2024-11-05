<template>
  <div class="apos-input__role__permission-grid">
    <div
      v-for="permissionSet in permissionSets"
      :key="permissionSet.name"
      class="apos-input__role__permission-grid__set"
    >
      <h4 class="apos-input__role__permission-grid__set-name">
        {{ $t(permissionSet.label) }}
        <AposIndicator
          v-if="permissionSet.includes"
          icon="help-circle-icon"
          class="apos-input__role__permission-grid__help"
          :tooltip="getTooltip(permissionSet.includes)"
          :icon-size="11"
          icon-color="var(--a-base-4)"
        />
      </h4>
      <dl class="apos-input__role__permission-grid__list">
        <div
          v-for="permission in permissionSet.permissions"
          :key="permission.name"
          class="apos-input__role__permission-grid__row"
        >
          <dd class="apos-input__role__permission-grid__value">
            <AposIndicator
              :icon="permission.value ? 'check-bold-icon' : 'close-icon'"
              :icon-color="permission.value ? 'var(--a-success)' : 'var(--a-base-5)'"
            />
            <span v-if="permission.value" class="apos-sr-only">
              {{ $t('apostrophe:enabled') }}
            </span>
            <span v-else class="apos-sr-only">
              {{ $t('apostrophe:disabled') }}
            </span>
          </dd>
          <dt class="apos-input__role__permission-grid__label">
            {{ $t(permission.label) }}
          </dt>
        </div>
      </dl>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposPermissionGrid',
  props: {
    apiParams: {
      type: Object,
      required: true,
      validator(value) {
        if (typeof value !== 'object') {
          return false;
        }

        const ROLE = 'role';
        const ROLES_BY_TYPE = 'rolesByType';
        const GROUPS = '_groups';

        const keys = Object.keys(value);
        const [ key ] = keys;

        if (keys.length > 1 || ![ ROLE, ROLES_BY_TYPE, GROUPS ].includes(key)) {
          return false;
        }
        if (value[ROLE] && typeof value[ROLE] !== 'string') {
          return false;
        }
        if (value[ROLES_BY_TYPE] && !Array.isArray(value[ROLES_BY_TYPE])) {
          return false;
        }
        if (value[GROUPS] && !Array.isArray(value[GROUPS])) {
          return false;
        }
        return true;
      }
    }
  },
  data() {
    return {
      permissionSets: []
    };
  },
  watch: {
    apiParams: {
      async handler() {
        this.permissionSets = await this.getPermissionSets();
      },
      deep: true
    }
  },
  async mounted() {
    this.permissionSets = await this.getPermissionSets();
  },
  methods: {
    getTooltip(includes) {
      const html = document.createElement('div');
      html.setAttribute('class', 'apos-info');
      const list = document.createElement('ul');
      const intro = document.createElement('p');
      const followUp = document.createElement('p');
      intro.appendChild(document.createTextNode(this.$t('apostrophe:piecePermissionsIntro')));
      followUp.appendChild(document.createTextNode(this.$t('apostrophe:piecePermissionsPieceTypeList')));
      html.appendChild(intro);
      html.appendChild(followUp);
      includes.forEach(item => {
        const li = document.createElement('li');
        li.appendChild(document.createTextNode(this.$t(item)));
        list.appendChild(li);
      });
      html.appendChild(list);

      return {
        content: html.innerHTML,
        localize: false
      };
    },
    async getPermissionSets() {
      const { permissionSets } = await apos.http.post(`${apos.permission.action}/grid`, {
        body: this.apiParams,
        busy: true
      });

      return permissionSets;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input__role__permission-grid {
    @include type-base;

    & {
      display: grid;
      margin-top: $spacing-triple;
      grid-template-columns: repeat(auto-fit, minmax(50%, 1fr));
    }
  }

  .apos-input__role__permission-grid__row {
    display: flex;
    align-items: center;
    margin-bottom: $spacing-three-quarters;
    padding-bottom: $spacing-three-quarters;
    border-bottom: 1px solid var(--a-base-9);
  }

  .apos-input__role__permission-grid__list {
    margin-top: 0;
  }

  .apos-input__role__permission-grid__set {
    margin-bottom: $spacing-double;
    padding: 0 $spacing-base;
  }

  .apos-input__role__permission-grid__set-name {
    @include type-title;

    & {
      display: inline-flex;
      margin: 0 0 $spacing-double;
    }
  }

  .apos-input__role__permission-grid__value {
    display: inline-flex;
    margin: 0 $spacing-half 0 0;
  }

  .apos-input__role__permission-grid__help {
    margin-left: $spacing-half;
  }
</style>

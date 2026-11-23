<template>
  <AposModal
    class="apos-oauth-connections"
    :modal="modal"
    :modal-title="$t('apostrophe:oauthConnections')"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:close"
        @click="close"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <p class="apos-oauth-connections__help">
            {{ $t('apostrophe:oauthConnectionsHelp') }}
          </p>
          <AposLoadingBlock v-if="!loaded" />
          <p
            v-else-if="loadFailed"
            class="apos-oauth-connections__empty"
            data-apos-test="oauthConnectionsLoadError"
          >
            {{ $t('apostrophe:oauthConnectionsLoadError') }}
          </p>
          <p
            v-else-if="!connections.length"
            class="apos-oauth-connections__empty"
            data-apos-test="oauthConnectionsEmpty"
          >
            {{ $t('apostrophe:oauthConnectionsEmpty') }}
          </p>
          <ul
            v-else
            class="apos-oauth-connections__list"
          >
            <li
              v-for="connection in connections"
              :key="connection._id"
              class="apos-oauth-connections__item"
              data-apos-test="oauthConnection"
            >
              <div class="apos-oauth-connections__about">
                <!-- The tool names itself: text only, never HTML -->
                <p class="apos-oauth-connections__name">
                  {{ getName(connection) }}
                </p>
                <p class="apos-oauth-connections__detail">
                  {{ $t('apostrophe:oauthReturnTo') }}
                  {{ getReturnTo(connection) }}
                </p>
                <p class="apos-oauth-connections__detail">
                  {{ $t('apostrophe:oauthConnectionsDates', {
                    approved: formatDate(connection.approvedAt),
                    used: formatDate(connection.lastUsedAt)
                  }) }}
                </p>
              </div>
              <AposButton
                type="default"
                label="apostrophe:oauthDisconnect"
                :disabled="busy"
                data-apos-test="oauthDisconnect"
                @click="disconnect(connection)"
              />
            </li>
          </ul>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import dayjs from 'dayjs';

// The user's own connected tools (see the oauth module's lib/connections.js),
// each of which they can disconnect
export default {
  name: 'AposOauthConnections',
  props: {
    // The connections API
    action: {
      type: String,
      required: true
    }
  },
  emits: [ 'modal-result' ],
  data() {
    return {
      modal: {
        active: false,
        showModal: false,
        type: 'overlay'
      },
      connections: [],
      loaded: false,
      loadFailed: false,
      busy: false
    };
  },
  async mounted() {
    this.modal.active = true;
    await this.load();
  },
  methods: {
    close() {
      this.modal.showModal = false;
    },
    async load() {
      try {
        const { connections } = await apos.http.get(this.action, { busy: true });
        this.connections = connections;
        this.loadFailed = false;
      } catch (e) {
        // Never "no tools are connected" when that isn't known
        this.loadFailed = true;
      } finally {
        this.loaded = true;
      }
    },
    async disconnect(connection) {
      const confirmed = await apos.confirm({
        heading: 'apostrophe:oauthDisconnectHeading',
        description: 'apostrophe:oauthDisconnectDescription',
        affirmativeLabel: 'apostrophe:oauthDisconnect'
      }, {
        interpolate: {
          name: this.getName(connection)
        }
      });
      if (!confirmed) {
        return;
      }
      this.busy = true;
      try {
        await apos.http.delete(`${this.action}/${encodeURIComponent(connection._id)}`, {
          busy: true
        });
        this.connections = this.connections
          .filter(({ _id }) => _id !== connection._id);
        await apos.notify('apostrophe:oauthDisconnected', {
          type: 'success',
          dismiss: true,
          interpolate: { name: this.getName(connection) }
        });
      } catch (e) {
        // Already gone, from another tab or because it ended: the list is
        // out of date
        if (e.status === 404) {
          await this.load();
          return;
        }
        await apos.notify('apostrophe:oauthDisconnectError', {
          type: 'danger',
          dismiss: true
        });
      } finally {
        this.busy = false;
      }
    },
    getName(connection) {
      return connection.clientName || this.$t('apostrophe:oauthConnectionsUnnamed');
    },
    // As the approval page says it: a host, or an app on this computer
    getReturnTo({ redirectTo }) {
      return redirectTo.local
        ? this.$t('apostrophe:oauthReturnToLocal', { name: redirectTo.host })
        : redirectTo.host;
    },
    formatDate(date) {
      return dayjs(date).format(this.$t('apostrophe:oauthConnectionsDateFormat'));
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-oauth-connections {
  @include type-base;

  :deep(.apos-modal__inner) {
    $width: min(600px, calc(100vw - 40px));
    $vertical-spacing: 95px;

    inset: $vertical-spacing calc(calc(100vw - #{$width}) / 2);
    width: $width;
    height: auto;
    max-height: calc(100vh - #{$vertical-spacing * 2});
  }

  :deep(.apos-modal__body-inner) {
    padding: $spacing-double $spacing-triple;
  }
}

.apos-oauth-connections__help {
  margin: 0 0 $spacing-double;
  color: var(--a-base-3);
}

.apos-oauth-connections__empty {
  margin: 0;
}

.apos-oauth-connections__list {
  @include apos-list-reset();
}

.apos-oauth-connections__item {
  display: flex;
  gap: $spacing-double;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-double 0;
  border-top: 1px solid var(--a-base-9);
}

.apos-oauth-connections__about {
  min-width: 0;
}

.apos-oauth-connections__name {
  @include type-large;

  & {
    margin: 0 0 $spacing-half;
    overflow-wrap: anywhere;
  }
}

.apos-oauth-connections__detail {
  margin: $spacing-half 0 0;
  line-height: 1.4;
  color: var(--a-base-3);
  overflow-wrap: anywhere;
}
</style>

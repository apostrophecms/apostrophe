<template>
  <transition name="fade-stage">
    <div
      class="apos-login apos-theme-dark"
      data-apos-test="loginForm"
      v-show="loaded"
      :class="themeClass"
    >
      <div class="apos-login__wrapper">
        <transition name="fade-body" mode="out-in">
          <div
            key="1"
            class="apos-login__upper"
            v-if="loaded && phase === 'beforeSubmit'"
          >
            <TheAposLoginHeader
              :env="context.env"
              :name="context.name"
              :error="$t(error)"
            />

            <div class="apos-login__body">
              <form @submit.prevent="submit">
                <AposSchema
                  :schema="schema"
                  v-model="doc"
                />
                <Component
                  v-for="requirement in beforeSubmitRequirements"
                  :key="requirement.name"
                  :is="requirement.component"
                  v-bind="getRequirementProps(requirement.name)"
                  @done="requirementDone(requirement, $event)"
                  @block="requirementBlock(requirement)"
                />
                <!-- TODO -->
                <!-- <a href="#" class="apos-login__link">Forgot Password</a> -->
                <AposButton
                  data-apos-test="loginSubmit"
                  :busy="busy"
                  :disabled="disabled"
                  type="primary"
                  label="apostrophe:login"
                  button-type="submit"
                  class="apos-login__submit"
                  :modifiers="['gradient-on-hover', 'block']"
                  @click="submit"
                />
              </form>
            </div>
          </div>
          <div
            key="2"
            class="apos-login__upper"
            v-else-if="activeSoloRequirement"
          >
            <TheAposLoginHeader
              :env="context.env"
              :name="context.name"
              :error="$t(error)"
              :tiny="true"
            />
            <div class="apos-login__body">
              <Component
                v-if="!fetchingRequirementProps"
                v-bind="getRequirementProps(activeSoloRequirement.name)"
                :is="activeSoloRequirement.component"
                :success="activeSoloRequirement.success"
                :error="activeSoloRequirement.error"
                @done="requirementDone(activeSoloRequirement, $event)"
                @confirm="requirementConfirmed(activeSoloRequirement)"
              />
            </div>
          </div>
        </transition>
      </div>
      <transition name="fade-footer">
        <div class="apos-login__footer" v-show="loaded">
          <AposLogo class="apos-login__logo" />
          <label class="apos-login__project-version">
            Version {{ context.version }}
          </label>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';

export default {
  name: 'TheAposLogin',
  mixins: [ AposThemeMixin ],
  data() {
    return {
      phase: 'beforeSubmit',
      mounted: false,
      beforeCreateFinished: false,
      error: '',
      busy: false,
      doc: {
        data: {},
        hasErrors: false
      },
      schema: [
        {
          name: 'username',
          label: 'Username',
          placeholder: 'Enter username',
          type: 'string',
          required: true
        },
        {
          name: 'password',
          label: 'Password',
          placeholder: 'Enter password',
          type: 'password',
          required: true
        }
      ],
      requirements: getRequirements(),
      context: {},
      requirementProps: {},
      fetchingRequirementProps: false
    };
  },
  computed: {
    loaded() {
      return this.mounted && this.beforeCreateFinished;
    },
    disabled() {
      return this.doc.hasErrors ||
        !!this.beforeSubmitRequirements.find(requirement => !requirement.done);
    },
    beforeSubmitRequirements() {
      return this.requirements.filter(requirement => requirement.phase === 'beforeSubmit');
    },
    // The currently active requirement expecting a solo presentation.
    // Currently it only concerns `afterPasswordVerified` requirements.
    // beforeSubmit requirements are not presented solo.
    activeSoloRequirement() {
      return (this.phase === 'afterPasswordVerified') &&
        this.requirements.find(requirement =>
          (requirement.phase === 'afterPasswordVerified') && !requirement.done
        );
    }
  },
  watch: {
    async activeSoloRequirement(newVal) {
      if (
        (this.phase === 'afterPasswordVerified') &&
        (newVal?.phase === 'afterPasswordVerified') &&
        newVal.propsRequired &&
        !(newVal.success || newVal.error)
      ) {
        try {
          this.fetchingRequirementProps = true;
          const data = await apos.http.post(`${apos.login.action}/requirement-props`, {
            busy: true,
            body: {
              name: newVal.name,
              incompleteToken: this.incompleteToken
            }
          });
          this.requirementProps = {
            ...this.requirementProps,
            [newVal.name]: data
          };
        } catch (e) {
          this.error = e.message || 'apostrophe:loginErrorGeneric';
        } finally {
          this.fetchingRequirementProps = false;
        }
      } else {
        return null;
      }
    }
  },
  async beforeCreate() {
    const stateChange = parseInt(window.sessionStorage.getItem('aposStateChange'));
    const seen = JSON.parse(window.sessionStorage.getItem('aposStateChangeSeen') || '{}');
    if (!seen[window.location.href]) {
      const lastModified = Date.parse(document.lastModified);
      if (stateChange && lastModified && (lastModified < stateChange)) {
        seen[window.location.href] = true;
        window.sessionStorage.setItem('aposStateChangeSeen', JSON.stringify(seen));
        location.reload();
        return;
      }
    }
    try {
      this.context = await apos.http.post(`${apos.login.action}/context`, {
        busy: true
      });
      this.requirementProps = this.context.requirementProps;
    } catch (e) {
      this.error = e.message || 'apostrophe:loginErrorGeneric';
    } finally {
      this.beforeCreateFinished = true;
    }
  },
  mounted() {
    this.mounted = true;
  },
  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';

      await this.invokeInitialLoginApi();
    },
    async invokeInitialLoginApi() {
      try {
        const response = await apos.http.post(`${apos.login.action}/login`, {
          busy: true,
          body: {
            ...this.doc.data,
            requirements: this.getInitialSubmitRequirementsData(),
            session: true
          }
        });
        if (response && response.incompleteToken) {
          this.incompleteToken = response.incompleteToken;
          this.phase = 'afterPasswordVerified';
        } else {
          this.redirectAfterLogin();
        }
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
        this.phase = 'beforeSubmit';
      } finally {
        this.busy = false;
      }
    },
    getInitialSubmitRequirementsData() {
      return Object.fromEntries(this.requirements.filter(r => r.phase !== 'afterPasswordVerified').map(r => ([
        r.name,
        r.value
      ])));
    },
    async invokeFinalLoginApi() {
      try {
        await apos.http.post(`${apos.login.action}/login`, {
          busy: true,
          body: {
            ...this.doc.data,
            incompleteToken: this.incompleteToken,
            requirements: this.getFinalSubmitRequirementsData(),
            session: true
          }
        });
        this.redirectAfterLogin();
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
        this.phase = 'beforeSubmit';
      } finally {
        this.busy = false;
      }
    },
    getFinalSubmitRequirementsData() {
      return Object.fromEntries(this.requirements.filter(r => r.phase === 'afterPasswordVerified').map(r => ([
        r.name,
        r.value
      ])));
    },
    redirectAfterLogin() {
      window.sessionStorage.setItem('aposStateChange', Date.now());
      window.sessionStorage.setItem('aposStateChangeSeen', '{}');
      // TODO handle situation where user should be sent somewhere other than homepage.
      // Redisplay homepage with editing interface
      location.assign(`${apos.prefix}/`);
    },
    async requirementBlock(requirementBlock) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementBlock.name);
      requirement.done = false;
      requirement.value = undefined;
    },
    async requirementDone(requirementDone, value) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementDone.name);

      if (requirement.phase === 'beforeSubmit') {
        requirement.done = true;
        requirement.value = value;
        return;
      }

      requirement.error = null;

      try {
        await apos.http.post(`${apos.login.action}/requirement-verify`, {
          busy: true,
          body: {
            name: requirement.name,
            value,
            incompleteToken: this.incompleteToken
          }
        });

        requirement.success = true;
      } catch (err) {
        requirement.error = err;
      }

      // Avoids the need for a deep watch
      this.requirements = [ ...this.requirements ];

      if (requirement.success && !requirement.askForConfirmation) {
        requirement.done = true;

        if (!this.activeSoloRequirement) {
          await this.invokeFinalLoginApi();
        }
      }
    },

    async requirementConfirmed (requirementConfirmed) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementConfirmed.name);

      requirement.done = true;

      if (!this.activeSoloRequirement) {
        await this.invokeFinalLoginApi();
      }
    },
    getRequirementProps(name) {
      return this.requirementProps[name] || {};
    }
  }
};

function getRequirements() {
  const requirements = Object.entries(apos.login.requirements).map(([ name, requirement ]) => {
    return {
      name,
      component: requirement.component || name,
      ...requirement,
      done: false,
      value: null,
      success: null,
      error: null
    };
  });
  return [
    ...requirements.filter(r => r.phase === 'beforeSubmit'),
    ...requirements.filter(r => r.phase === 'afterPasswordVerified')
  ];
}
</script>

<style lang="scss">
  .apos-login-page {
    margin: 0;
  }
</style>

<style lang="scss" scoped>
  $login-container: 330px;

  .apos-login__logo {
    width: 100%;
    max-width: 150px;
  }

  .fade-stage-enter-active {
    transition: opacity 0.2s linear;
    transition-delay: 0.3s;
  }

  .fade-stage-enter-to,
  .fade-body-enter-to,
  .fade-footer-enter-to,
  .fade-body-leave {
    opacity: 1;
  }

  .fade-stage-enter,
  .fade-body-enter,
  .fade-footer-enter,
  .fade-body-leave-to {
    opacity: 0;
  }

  .fade-body-enter-active {
    transition: all 0.25s linear;
    transition-delay: 0.6s;
  }

  .fade-body-leave-active {
    transition: all 0.25s linear;
  }

  .fade-body-enter-to, .fade-body-leave {
    transform: translateY(0);
  }

  .fade-body-enter, .fade-body-leave-to {
    transform: translateY(4px);
  }

  .fade-footer-enter-active {
    transition: opacity 0.4s linear;
    transition-delay: 1s;
  }

  .apos-login {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100vh;
    background-color: var(--a-background-primary);

    &__wrapper {
      width: 100%;
      max-width: $login-container;
      margin: 0 auto;
    }

    form {
      position: relative;
      display: flex;
      flex-direction: column;

      button {
        margin-top: $spacing-double;
      }
    }

    &__loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;

      .apos-spinner {
        width: 38px;
        height: 38px;
        margin-top: 20px;
      }
    }

    &__footer {
      @include type-base;
      position: absolute;
      right: 0;
      bottom: 32px;
      left: 0;
      display: flex;
      width: 100%;
      max-width: $login-container;
      margin: auto;
      align-items: center;
      justify-content: flex-start;
    }

    &__project-version {
      overflow: hidden;
      text-overflow: clip;
      white-space: nowrap;
      color: var(--a-base-5);
      margin-right: 0;
      margin-left: auto;
    }
  }

  .apos-login__submit ::v-deep .apos-button {
    height: 47px;
  }
</style>

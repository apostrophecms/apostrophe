// This is the business logic of the TheAposLogin Vue component.
// It is in a separate file so that you can override the component's templates
// and styles just by copying the .vue file to your project, and leave the business logic
// unchanged.

import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';

const STAGES = [
  'login',
  'forgotPassword',
  'resetPassword'
];

export default {
  mixins: [ AposThemeMixin ],
  data() {
    return {
      stage: STAGES[0],
      mounted: false,
      beforeCreateFinished: false,
      error: '',
      passwordResetData: {},
      context: {}
    };
  },
  computed: {
    loaded() {
      return this.mounted && this.beforeCreateFinished;
    },
    showNav() {
      return this.stage !== STAGES[0];
    },
    homeUrl() {
      return `${apos.prefix}/`;
    }
  },
  // We need it here and not in the login form because the version used in the footer.
  // The context will be passed to every form, might be a good thing in the future.
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
    } catch (e) {
      this.context = {};
      this.error = e.message || 'apostrophe:loginErrorGeneric';
    } finally {
      this.beforeCreateFinished = true;
    }
  },
  created() {
    const url = new URL(document.location);
    const data = {
      email: url.searchParams.get('email'),
      reset: url.searchParams.get('reset')
    };
    if (data.email && data.reset) {
      this.passwordResetData = data;
      this.setStage('resetPassword');
    }
  },
  mounted() {
    this.mounted = true;
  },
  methods: {
    setStage(name) {
      // 1. Enabled status per stage. A bit cryptic but effective.
      // Search for a method composed of the `name` + `Enabled`
      // (e.g. `forgotPasswordEnabled` and execute it (should return boolean).
      // If no method is found it is enabled. Fallback to the default stage.
      const enabled = this[`${name}Enabled`]?.() ?? true;
      if (!enabled) {
        this.stage = STAGES[0];
        return;
      }
      // 2. Set it only if it's a known stage
      if (STAGES.includes(name)) {
        this.stage = name;
        return;
      }
      // 3. Fallback to the default stage
      this.stage = STAGES[0];
    },
    forgotPasswordEnabled() {
      return apos.login.passwordResetEnabled;
    },
    resetPasswordEnabled() {
      return apos.login.passwordResetEnabled;
    },
    onRedirect(loc) {
      window.sessionStorage.setItem('aposStateChange', Date.now());
      window.sessionStorage.setItem('aposStateChangeSeen', '{}');
      location.assign(loc);
    }
  }
};

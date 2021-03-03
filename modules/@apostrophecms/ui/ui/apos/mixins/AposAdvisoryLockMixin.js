export default {
  data() {
    return {
      locked: false,
      lockTimeout: null,
      lockRefreshing: null,
      lockApiUrl: null
    };
  },
  async destroyed () {
    await this.unlock();
  },
  methods: {
    async lock(lockApiUrl) {
      this.lockApiUrl = lockApiUrl;
      try {
        await apos.http.patch(lockApiUrl, {
          body: {
            _advisoryLock: {
              htmlPageId: apos.adminBar.htmlPageId,
              lock: true
            }
          },
          draft: true,
          busy: true
        });
        this.markLockedAndScheduleRefresh();
        return true;
      } catch (e) {
        if (e.body && e.body && e.body.name === 'locked') {
          // We do not ask before busting our own advisory lock.
          // We used to do this in A2 but end users told us they hated it and
          // were constantly confused by it. This is because there is no
          // way to guarantee a lock is dropped when leaving the page
          // in edit mode. However, in the rare case where the "other tab"
          // getting its lock busted really is another tab, we do notify
          // the user there.
          if (e.body.data.me ||
            await apos.confirm({
              heading: 'Another User Is Editing',
              description: `${e.body.data.title} is editing that document. Do you want to take control?`
            })
          ) {
            try {
              await apos.http.patch(this.lockApiUrl, {
                body: {
                  _advisoryLock: {
                    htmlPageId: apos.adminBar.htmlPageId,
                    lock: true,
                    force: true
                  }
                },
                draft: true,
                busy: true
              });
              this.markLockedAndScheduleRefresh();
              return true;
            } catch (e) {
              await apos.notify(e.message, {
                type: 'error'
              });
              this.lockNotAvailable();
              return false;
            }
          } else {
            this.lockNotAvailable();
            return true;
          }
        }
      }
    },
    markLockedAndScheduleRefresh() {
      this.locked = true;
      this.lockTimeout = setTimeout(this.refreshLock, 10000);
    },
    refreshLock() {
      this.lockRefreshing = (async () => {
        try {
          await apos.http.patch(this.lockApiUrl, {
            body: {
              _advisoryLock: {
                htmlPageId: apos.adminBar.htmlPageId,
                lock: true
              }
            },
            draft: true
          });
          // Reset this each time to avoid various race conditions
          this.lockTimeout = setTimeout(this.refreshLock, 10000);
        } catch (e) {
          if (e.body && e.body.name && (e.body.name === 'locked')) {
            await this.showLockedError(e);
            clearTimeout(this.lockTimeout);
            this.lockTimeout = null;
            this.locked = false;
            return this.lockNotAvailable();
          }
          // Other errors on this are not critical
        }
        this.lockRefreshing = null;
      })();
    },
    async showLockedError(e) {
      if (e.body.data.me) {
        // We use an alert because it is a clear interruption of their
        // work, and because a notification would appear in both windows
        // if control was taken by the same user in another window,
        // which would be confusing.
        await apos.alert({
          heading: 'You Took Control in Another Window',
          description: 'You took control of this document in another tab or window.'
        });
      } else {
        await apos.alert({
          heading: 'Another User Took Control',
          description: 'Another user took control of the document.'
        });
      }
    },
    // Add an appropriate `_advisoryLock` property to the given request body,
    // such that a PUT request will fail if someone else has taken the lock
    addLockToRequest(body) {
      body._advisoryLock = {
        htmlPageId: apos.adminBar.htmlPageId,
        lock: true
      };
    },
    async unlock() {
      if (this.locked) {
        clearTimeout(this.lockTimeout);
        if (this.lockRefreshing) {
          // First await the promise we held onto to make sure there is
          // no race condition that leaves the lock in place
          await this.lockRefreshing;
        }
        try {
          await apos.http.patch(this.lockApiUrl, {
            body: {
              _advisoryLock: {
                htmlPageId: apos.adminBar.htmlPageId,
                lock: false
              }
            },
            draft: true,
            busy: true
          });
        } catch (e) {
          // Not our concern, just being polite
        }
      }
    }
  }
};

// Provides reusable UI methods relating to obtaining an advisory lock on a document.
// In addition to using the methods documented here, the component must implement the
// `lockNotAvailable` method, which should take appropriate steps if a lock is lost,
// such as closing a modal.

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
    // lockApiUrl must be the REST API URL of the document, for instance this might be
    // `${this.action}/${this.doc._id}`. Returns true if the lock was obtained, false
    // if it was not. Also schedules regular refreshes of the lock, which may lead to
    // a call to `lockNotAvailable`, a method that your component must supply. That method
    // should close the modal or take other appropriate action when the document cannot
    // be edited. The user has already been notified at that point.
    //
    // `lockNotAvailable` is only called if the lock is lost *after* this method succeeds.
    // To detect a failure to initially lock, look for a `false` return from this method.
    // If you wish you may call your `lockNotAvailable` method yourself in that situation
    // after taking other appropriate actions to prevent the opening of the document.

    async lock(lockApiUrl) {
      this.lockApiUrl = lockApiUrl;
      try {
        await apos.http.patch(lockApiUrl, {
          body: {
            _advisoryLock: {
              tabId: apos.adminBar.tabId,
              lock: true
            }
          },
          draft: true,
          busy: true
        });
        this.markLockedAndScheduleRefresh();
        return true;
      } catch (e) {
        if (this.isLockedError(e)) {
          if (await apos.confirm({
            heading: e.body.data.me ? 'apostrophe:docInUseBySelf' : 'apostrophe:docInUseByAnother',
            description: e.body.data.me ? 'apostrophe:takeControlFromSelf' : 'apostrophe:takeControlFromOther',
            interpolate: {
              who: e.body.data.title
            }
          })) {
            try {
              await apos.http.patch(this.lockApiUrl, {
                body: {
                  _advisoryLock: {
                    tabId: apos.adminBar.tabId,
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
                type: 'error',
                localize: false
              });
              return false;
            }
          } else {
            return false;
          }
        }
      }
    },

    // Displays the locked error message appropriately. Overriding this method
    // is permitted. Note the detection of whether the lock was taken by the
    // same person (in another tab) or by someone else.
    //
    // When using `addLockToRequest` with your own API call, it is your responsibility to
    // detect lock errors with `isLockedError` and call this method. The rest of the time,
    // it is called for you.
    async showLockedError(e) {
      await apos.alert({
        heading: 'apostrophe:multipleEditors',
        description: e.body.data.me ? 'apostrophe:youTookControl' : 'apostrophe:someoneElseTookControl',
        interpolate: {
          who: e.body.data.title
        }
      });
    },

    // Convenience function to determine if an error is a lock error.
    // See `addLockToRequest` for more information.
    isLockedError(e) {
      return e && e.body && e.body.name === 'locked';
    },

    // Call this method on a request body you are about to send with a PUT or PATCH
    // request in order to ensure it is detected if someone else has taken the lock
    // since the last time we refreshed it. If an error occurs on the request
    // call `this.isLockedError(e)` to determine if it is a lock error. If so,
    // call `this.showLockedError(e)` and then take appropriate steps to close
    // your document, which can be as simple as calling the `this.lockNotAvailable()`
    // method you already wrote.
    addLockToRequest(body) {
      body._advisoryLock = {
        tabId: apos.adminBar.tabId,
        lock: true
      };
    },

    // Await this method when you are ready to release the lock. If the lock was never
    // obtained, this method does nothing.
    //
    // This method is automatically called when your component is destroyed. Calling it
    // manually is only necessary if you lock and unlock various documents over the
    // lifetime of the component.
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
                tabId: apos.adminBar.tabId,
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
    },

    // Implementation detail, do not call.
    markLockedAndScheduleRefresh() {
      this.locked = true;
      this.lockTimeout = setTimeout(this.refreshLock, 10000);
    },

    // Implementation detail, do not call.
    refreshLock() {
      this.lockRefreshing = (async () => {
        try {
          await apos.http.patch(this.lockApiUrl, {
            body: {
              _advisoryLock: {
                tabId: apos.adminBar.tabId,
                lock: true
              }
            },
            draft: true
          });
          // Reset this each time to avoid various race conditions
          this.lockTimeout = setTimeout(this.refreshLock, 10000);
        } catch (e) {
          if (this.isLockedError(e)) {
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
    }
  }
};

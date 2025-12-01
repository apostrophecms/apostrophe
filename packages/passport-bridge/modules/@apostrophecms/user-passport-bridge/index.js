module.exports = {
  improve: '@apostrophecms/user',
  methods(self) {
    return {
      // Resolves to `{ accessToken, refreshToken }`, or `null` if
      // none are available for the given passport strategy.
      async getTokens(user, strategy) {
        if ((!user) || (!user._id)) {
          throw self.apos.error('error', 'First argument must be an apostrophe user object');
        }
        if (!strategy) {
          throw self.apos.error('error', 'Second argument must be a passport strategy name');
        }
        const info = await self.safe.findOne({
          _id: user._id
        });
        if (!info) {
          // Should never happen
          throw self.apos.error('error', 'User has no entry in the safe');
        }
        return info?.tokens?.[strategy] || null;
      },
      async updateTokens(user, strategy, { accessToken, refreshToken }) {
        await self.safe.updateOne({
          _id: user._id
        }, {
          $set: {
            [`tokens.${strategy}`]: {
              accessToken,
              refreshToken
            }
          }
        });
      },
      async refreshTokens(user, strategy, refreshToken) {
        const originalRefreshToken = refreshToken;
        if (!refreshToken) {
          ({ refreshToken } = await self.getTokens(user, strategy));
        }
        const refresh = self.apos.modules['@apostrophecms/passport-bridge'].refresh;
        return new Promise((resolve, reject) => {
          return refresh.requestNewAccessToken(
            strategy,
            refreshToken,
            async (err, accessToken, refreshToken) => {
              if (err) {
                return reject(err);
              }
              const newRefreshToken = refreshToken || originalRefreshToken;
              try {
                await self.updateTokens(user, strategy, {
                  accessToken,
                  refreshToken: newRefreshToken
                });
              } catch (e) {
                return reject(e);
              }
              return resolve({
                accessToken,
                refreshToken: newRefreshToken
              });
            }
          );
        });
      },
      async withAccessToken(user, strategy, fn) {
        let accessToken, refreshToken;
        try {
          const tokens = await self.getTokens(user, strategy);
          if (!tokens) {
            throw self.apos.error('notfound');
          }
          ({ accessToken, refreshToken } = tokens);
          // We need "return await" because we want to catch async errors
          return await fn(accessToken);
        } catch (e) {
          if (e.status && e.status === 401) {
            const {
              accessToken
            } = await self.refreshTokens(user, strategy, refreshToken);
            // On the second try, failure is failure
            // We don't need "await" because we are already returning
            // a promise
            return fn(accessToken);
          } else {
            // Unrelated error
            throw e;
          }
        }
      },

      async requestConnection(req, strategyName, options = {}) {
        if (!req.user) {
          throw self.apos.error('forbidden', 'No user');
        }
        const bridge = self.apos.modules['@apostrophecms/passport-bridge'];
        const strategy = bridge.strategies[strategyName];
        if (!strategy) {
          throw self.apos.error('notfound', 'No such strategy');
        }
        const token = self.apos.util.generateId();
        await self.safe.updateOne({
          _id: req.user._id
        }, {
          $set: {
            [`connectionRequests.${strategyName}`]: {
              token,
              expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
              options
            }
          }
        });
        const url = bridge.getConnectUrl(strategyName, token, true);
        const site = (new URL(self.apos.baseUrl)).hostname;

        await bridge.email(req,
          'connectionRequestEmail',
          {
            site,
            strategyName,
            url,
            user: req.user

          }, {
            to: req.user.email,
            subject: req.t('aposPassportBridge:connectionRequest', {
              strategyName,
              site
            })
          }
        );
      }
    };
  }
};

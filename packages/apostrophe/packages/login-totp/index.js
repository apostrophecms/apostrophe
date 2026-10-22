const { randomBytes } = require('crypto');
const base32 = require('thirty-two');
const totp = require('totp-generator');
const path = require('path');
const fs = require('fs');

module.exports = {
  improve: '@apostrophecms/login',
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  i18n: {
    aposTotp: {
      browser: true
    }
  },
  init (self, { totp }) {
    if (!totp.secret) {
      self.apos.util.warn('You should provide a secret 10 characters in length in the login module\'s config.');
    } else if (totp.secret.length !== 10) {
      self.apos.util.warn('Your secret should be exactly 10 characters in length.');
    }
  },
  requirements(self) {
    return {
      add: {
        AposTotp: {
          phase: 'afterPasswordVerified',
          askForConfirmation: true,
          async props(req, user) {
            const safe = await self.apos.user.safe.findOne({
              _id: user._id
            });
            if (!safe.totp || !safe.totp.activated) {
              const validSecret = self.getSecret();
              const hash = randomBytes(validSecret ? 5 : 10).toString('hex');
              const token = self.generateToken(hash, validSecret);
              const result = await self.apos.user.safe.updateOne({
                _id: user._id
              }, {
                $set: {
                  totp: {
                    hash,
                    activated: false
                  }
                }
              });
              if (!result.modifiedCount) {
                throw self.apos.error('notfound');
              }
              return {
                token,
                // Allows multiple identities on the same site to be distinguished
                // in a TOTP app
                identity: `${user.username}@${self.apos.shortName}`
              };
            }

            return {};
          },
          async verify(req, data, user) {
            const code = self.apos.launder.string(data);

            if (!code) {
              throw self.apos.error('invalid', req.t('aposTotp:invalidToken'));
            }

            const safe = await self.apos.user.safe.findOne({
              _id: user._id
            });
            if (!safe.totp) {
              throw self.apos.error('invalid', req.t('aposTotp:notConfigured'));
            }
            const userToken = self.generateToken(safe.totp.hash, self.getSecret());
            const totpToken = totp(userToken);

            if (totpToken !== code) {
              self.logInfo(req, 'totp-invalid-token', {
                username: safe.username
              });
              throw self.apos.error('invalid', req.t('aposTotp:invalidToken'));
            }

            if (!safe.totp.activated) {
              try {
                const result = await self.apos.user.safe.updateOne({
                  _id: user._id
                }, {
                  $set: {
                    'totp.activated': true
                  }
                });
                if (!result.modifiedCount) {
                  throw self.apos.error('notfound');
                }
              } catch (err) {
                throw self.apos.error('unprocessable', req.t('aposTotp:updateError'));
              }
            }

            self.logInfo(req, 'totp-complete', {
              username: safe.username
            });
          }
        }
      }
    };
  },
  methods(self) {
    return {
      generateToken (hash, secret) {
        const formattedSecret = secret
          ? secret.substring(0, 10)
          : '';

        return base32.encode(hash + formattedSecret).toString();
      },
      getSecret () {
        const { secret } = self.options.totp;

        return secret;
      }
    };
  }
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}

const fetch = require('node-fetch');
const { createId } = require('@paralleldrive/cuid2');
const path = require('path');
const util = require('util');
const FormData = require('form-data');
const fs = require('fs');
const sharp = require('sharp');
const unlink = util.promisify(fs.unlink);
const writeFile = util.promisify(fs.writeFile);

module.exports = {
  improve: '@apostrophecms/image',
  icons: {
    'robot-icon': 'Robot',
    'group-icon': 'Group'
  },
  utilityOperations: {
    add: {
      aiInsertImage: {
        label: 'aposAiHelper:utilityOperationLabel',
        icon: 'robot-icon',
        iconOnly: true,
        relationships: true,
        button: true,
        modalOptions: {
          modal: 'AposAiHelperImageManager'
        },
        canCreate: true
      }
    }
  },
  async init(self) {
    self.uploadfs = self.apos.uploadfs;
    self.aiHelperImages = self.apos.db.collection('aposAiHelperImages');
    await self.aiHelperImages.createIndex({
      userId: 1,
      createdAt: -1
    });
    self.scheduleCleanup();
  },
  methods(self) {
    return {
      scheduleCleanup() {
        setInterval(self.cleanup, 1000 * 60 * 60);
      },
      async cleanup() {
        const images = await self.aiHelperImages.find({
          createdAt: {
            // OpenAI image URLs were originally only good for an hour, and
            // it's not a bad policy: the ones you don't use are
            // kept for an hour
            $lt: new Date(Date.now() - 1000 * 60 * 60)
          }
        }).toArray();
        for (const image of images) {
          await self.aiHelperRemoveImage(image._id);
        }
      },
      // Fetch the image to a temporary file and return the path to that file
      async aiHelperFetchImage(req, image) {
        const response = await fetch(self.aiHelperImageUrl(req, image));
        const buffer = await response.buffer();
        const temp = path.join(self.apos.rootDir, `data/temp/${image._id}.png`);
        await writeFile(temp, buffer);
        return temp;
      },
      // Write a base64 image to uploadfs
      async aiHelperWriteImageToUploadfs(_id, base64) {
        const temp = path.join(self.apos.rootDir, `data/temp/${_id}.png`);
        try {
          await writeFile(temp, Buffer.from(base64, 'base64'));
          await util.promisify(self.uploadfs.copyIn)(temp, `/ai-helper-images/${_id}.png`);
        } finally {
          try {
            await unlink(temp);
          } catch (e) {
            self.apos.util.warn(e);
            // never got that far
          }
        }
      },
      aiHelperImageUrl(req, image) {
        return image.url || (new URL(self.uploadfs.getUrl() + `/ai-helper-images/${image._id}.png`, req.baseUrl)).toString();
      },
      async aiHelperRemoveImage(_id, criteria = {}) {
        const aiImage = await self.aiHelperImages.findOne({
          _id,
          ...criteria
        });
        if (!aiImage) {
          // Already gone, races are normal for this in multiserver
          return;
        }
        if (!aiImage.url) {
          // Newer image, received as base64, now in uploadfs waiting to be removed
          try {
            await util.promisify(self.uploadfs.remove)(`/ai-helper-images/${_id}.png`);
          } catch (e) {
            // Probably already deleted
            self.apos.util.warn(e);
          }
        }
        await self.aiHelperImages.deleteOne({ _id });
      }
    };
  },
  apiRoutes(self) {
    return {
      get: {
        async 'ai-helper'(req) {
          const images = await self.aiHelperImages.find({
            userId: req.user._id,
            createdAt: {
              // OpenAI image URLs were originally only good for an hour, and
              // it's not a bad policy: the ones you don't use are
              // kept for an hour
              $gte: new Date(Date.now() - 1000 * 60 * 60)
            }
          }).sort({
            createdAt: -1
          }).toArray();
          for (const image of images) {
            image.url ||= self.aiHelperImageUrl(req, image);
          }
          return {
            images
          };
        }
      },
      delete: {
        async 'ai-helper/:_id'(req) {
          await self.aiHelperRemoveImage(req.params._id, {
            userId: req.user._id
          });
          return {};
        }
      },
      post: {
        async 'ai-helper'(req) {
          const aiHelper = self.apos.modules['@apostrophecms/ai-helper'];
          aiHelper.checkPermissions(req);
          const prompt = self.apos.launder.string(req.body.prompt);
          const variantOf = self.apos.launder.id(req.body.variantOf);
          if (!prompt.length) {
            throw self.apos.error('invalid');
          }
          const body = variantOf ? new FormData() : {};
          if (!variantOf) {
            set('prompt', prompt);
          } else {
            set('prompt', `${prompt} (but a little different this time)`);
          }
          // The modern models are slow and tend to nail it, so don't make things
          // even slower by generating multiples every time
          set('n', 1);
          set('size', '1024x1024');
          set('model', aiHelper.options.imageModel);
          let temp;
          // Fake results for cheap & offline testing
          if (process.env.APOS_AI_HELPER_MOCK) {
            const now = new Date();
            const images = [];
            for (let i = 0; (i < 4); i++) {
              images.push({
                _id: createId(),
                userId: req.user._id,
                createdAt: now,
                url: self.apos.asset.url('/modules/@apostrophecms/ai-helper-image/placeholder.jpg')
              });
            }
            return {
              images
            };
          }
          try {
            if (variantOf) {
              const existing = await self.aiHelperImages.findOne({
                _id: variantOf
              });
              if (!existing) {
                throw self.apos.error('notfound');
              }
              temp = await self.aiHelperFetchImage(req, existing);
              body.append('image', fs.createReadStream(temp));
            }
            const command = variantOf ? 'edits' : 'generations';
            const result = await self.apos.http.post(`https://api.openai.com/v1/images/${command}`, {
              headers: {
                Authorization: `Bearer ${process.env.APOS_OPENAI_KEY}`
              },
              body
            });
            if (temp) {
              fs.unlinkSync(temp);
            }
            if (!result.data) {
              throw self.apos.error('error');
            }
            const images = [];
            const now = new Date();
            for (const item of result.data) {
              const id = createId();
              const image = {
                _id: id,
                userId: req.user._id,
                createdAt: now,
                uploadfs: !!item.b64_json,
                prompt
              };
              if (item.b64_json) {
                await self.aiHelperWriteImageToUploadfs(id, item.b64_json);
              }
              item.b64_json = true;
              // Do not write url to the database, that's our cue that it has
              // to be loaded on demand
              await self.aiHelperImages.insertOne(image);
              image.url = self.aiHelperImageUrl(req, image);
              images.push(image);
            }
            return {
              images
            };
          } catch (e) {
            if (e.status === 429) {
              self.apos.notify(req, 'aposAiHelper:rateLimitExceeded');
            } else if (e.status === 400) {
              self.apos.util.error(e);
              self.apos.notify(req, 'aposAiHelper:invalidRequest');
            } else {
              self.apos.util.error(e);
            }
            throw e;
          } finally {
            if (temp) {
              try {
                await unlink(temp);
              } catch (e) {
                // Don't care if it never got there
              }
            }
          }
          function set(key, value) {
            if (variantOf) {
              body.append(key, value);
            } else {
              body[key] = value;
            }
          }
        }
      },
      patch: {
        async 'ai-helper/:_id'(req) {
          const _id = req.params._id;
          if (!req.body.accepted) {
            // Currently the only property that can be PATCHed is "accepted"
            throw self.apos.error('invalid');
          }
          if (!_id.length) {
            throw self.apos.error('invalid');
          }
          const helperImage = await self.aiHelperImages.findOne({ _id });
          if (!helperImage) {
            throw self.apos.error('notfound');
          }
          const { prompt } = helperImage;
          // apos.http has a bug with binary data, use node-fetch
          let temp;
          let tempJpg;
          try {
            temp = await self.aiHelperFetchImage(req, helperImage);
            const tempJpg = temp.replace(/\.\w+$/, '') + '.jpg';
            await sharp(temp).toFile(tempJpg);
            const attachment = await self.apos.attachment.insert(req, {
              name: self.apos.util.slugify(prompt) + '.jpg',
              path: tempJpg
            });
            const image = await self.apos.image.insert(req, {
              title: prompt,
              attachment
            });
            self.apos.attachment.all(image, { annotate: true });
            const updated = {
              ...image,
              accepted: true,
              imageId: image._id,
              _image: image
            };
            await self.aiHelperImages.updateOne({ _id }, {
              $set: {
                accepted: true,
                imageId: image._id
              }
            });
            return updated;
          } finally {
            try {
              if (temp) {
                await unlink(temp);
              }
              if (tempJpg) {
                await unlink(tempJpg);
              }
            } catch (e) {
              // We don't care if it never got there
            }
          }
        }
      }
    };
  }
};

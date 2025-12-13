const { createId } = require('@paralleldrive/cuid2');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const sharp = require('sharp');

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
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tempDir = self.getTempDir(self);
        await fsp.mkdir(tempDir, { recursive: true });

        const temp = path.join(tempDir, `${image._id}.png`);
        await fsp.writeFile(temp, buffer);
        return temp;
      },

      async aiHelperFetchImageForEdits(req, image) {
        const response = await fetch(self.aiHelperImageUrl(req, image));
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        const tempDir = self.getTempDir(self);
        await fsp.mkdir(tempDir, { recursive: true });

        const temp = path.join(tempDir, `${image._id}.png`);

        await sharp(buffer)
          .ensureAlpha()
          .png()
          .toFile(temp);

        return temp;
      },

      // Write a base64 image to uploadfs
      async aiHelperWriteImageToUploadfs(_id, base64) {
        const tempDir = self.getTempDir(self);
        await fsp.mkdir(tempDir, { recursive: true });

        const temp = path.join(tempDir, `${_id}.png`);
        try {
          await fsp.writeFile(temp, Buffer.from(base64, 'base64'));
          await new Promise((resolve, reject) => {
            self.uploadfs.copyIn(temp, `/ai-helper-images/${_id}.png`, err =>
              err ? reject(err) : resolve()
            );
          });

        } finally {
          try {
            await fsp.unlink(temp);
          } catch (e) {
            self.apos.util.warn(e);
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
            await new Promise((resolve, reject) => {
              self.uploadfs.remove(`/ai-helper-images/${_id}.png`, err =>
                err ? reject(err) : resolve()
              );
            });

          } catch (e) {
            // Probably already deleted
            self.apos.util.warn(e);
          }
        }
        await self.aiHelperImages.deleteOne({ _id });
      },

      getTempDir(self) {
        return path.join(self.apos.rootDir, 'data', 'temp');
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
              $gte: new Date(Date.now() - 1000 * 60 * 60)
            }
          }).sort({
            createdAt: -1
          }).toArray();

          // Ensure all images have URLs
          for (const image of images) {
            image.url ||= self.aiHelperImageUrl(req, image);
          }

          return { images };
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

          let temp = null;

          // Fake results for cheap & offline testing
          if (process.env.APOS_AI_HELPER_MOCK) {
            const now = new Date();
            const images = [];
            for (let i = 0; i < 4; i++) {
              images.push({
                _id: createId(),
                userId: req.user._id,
                createdAt: now,
                url: self.apos.asset.url('/modules/@apostrophecms/ai-helper-image/placeholder.jpg')
              });
            }
            return { images };
          }

          try {
            // Get the configured image provider
            const provider = aiHelper.getImageProvider();

            let result;

            if (variantOf) {
              // Check if provider supports edits/variations
              if (!provider.capabilities.imageVariation) {
                throw self.apos.error('invalid',
                  `Provider "${aiHelper.options.imageProvider}" does not support image variations`
                );
              }

              // Generate variations (edits)
              const existing = await self.aiHelperImages.findOne({ _id: variantOf });
              if (!existing) {
                throw self.apos.error('notfound');
              }

              // Use the special method that ensures RGBA format
              temp = await self.aiHelperFetchImageForEdits(req, existing);

              result = await provider.module.generateImageVariation(req, temp, prompt);
            } else {
              // Generate new images
              result = await provider.module.generateImage(req, prompt);
            }

            // Result can be either URLs or base64
            const images = [];
            const now = new Date();

            for (const item of result) {
              const id = createId();
              const image = {
                _id: id,
                userId: req.user._id,
                createdAt: now,
                uploadfs: !!item.b64_json,
                prompt
              };

              // If base64, store in uploadfs
              if (item.b64_json) {
                await self.aiHelperWriteImageToUploadfs(id, item.b64_json);
              }

              // Don't write url to the database if using uploadfs
              if (!item.b64_json) {
                await self.aiHelperImages.insertOne({ ...image, url: item.url });
              } else {
                await self.aiHelperImages.insertOne(image);
              }

              // Ensure URL for response
              image.url = self.aiHelperImageUrl(req, image);
              images.push(image);
            }

            return { images };

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
            // Clean up temporary file if it exists
            if (temp) {
              try {
                await fsp.unlink(temp);
              } catch (e) {
                // Don't care if cleanup fails
              }
            }
          }
        }
      },

      patch: {
        async 'ai-helper/:_id'(req) {
          const _id = req.params._id;

          if (!req.body.accepted) {
            throw self.apos.error('invalid');
          }

          const helperImage = await self.aiHelperImages.findOne({ _id });
          if (!helperImage) {
            throw self.apos.error('notfound');
          }

          const { prompt } = helperImage;
          let temp;
          let tempJpg;

          try {
            temp = await self.aiHelperFetchImage(req, helperImage);
            tempJpg = temp.replace(/\.\w+$/, '') + '.jpg';
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
              if (temp) await fsp.unlink(temp);
              if (tempJpg) await fsp.unlink(tempJpg);
            } catch (e) {
              // We don't care if it never got there
            }
          }
        }
      }
    };
  }
};

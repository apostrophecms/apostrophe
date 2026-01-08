const { createId } = require('@paralleldrive/cuid2');
const path = require('node:path');
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
            // Images are kept for an hour if not used
            $lt: new Date(Date.now() - 1000 * 60 * 60)
          }
        }).toArray();
        for (const image of images) {
          await self.aiHelperRemoveImage(image._id);
        }
      },

      async getTempImagePath(image) {
        const dir = path.join(self.apos.rootDir, 'data', 'temp');
        await fsp.mkdir(dir, { recursive: true });
        return path.join(dir, `${image._id}.png`);
      },

      async aiHelperFetchImage(req, image) {
        const response = await fetch(self.aiHelperImageUrl(req, image));
        const buffer = Buffer.from(await response.arrayBuffer());

        const temp = await self.getTempImagePath(image);
        await fsp.writeFile(temp, buffer);
        return temp;
      },

      async aiHelperWriteImageToUploadfs(image, base64) {
        const temp = await self.getTempImagePath(image);
        try {
          await fsp.writeFile(temp, Buffer.from(base64, 'base64'));
          await new Promise((resolve, reject) => {
            self.uploadfs.copyIn(temp, `/ai-helper-images/${image._id}.png`, err =>
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

      validateProviderResponse(providerResponse) {
        if (!Array.isArray(providerResponse)) {
          throw new Error('Provider must return an array of image results');
        }

        for (const item of providerResponse) {
          if (!item.type || !item.data) {
            throw new Error(
              'Provider response must include "type" and "data" fields. ' +
              'Expected format: {type: "url"|"base64", data: string, metadata?: object}'
            );
          }
          if (![ 'url', 'base64' ].includes(item.type)) {
            throw new Error(`Invalid type "${item.type}". Must be "url" or "base64"`);
          }
        }

        return providerResponse;
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

          const emitUsage = async ({
            providerLabel,
            providerMetadata,
            count,
            variantOfId
          }) => {
            if (!(aiHelper.options.storeUsage || aiHelper.options.logUsage)) {
              return;
            }
            const usage = {
              type: 'image',
              provider: providerLabel,
              prompt,
              metadata: {
                ...(providerMetadata || {}),
                count,
                ...(variantOfId ? { variantOf: variantOfId } : {})
              }
            };
            if (aiHelper.options.storeUsage) {
              await aiHelper.storeUsage(req, usage);
            }
            if (aiHelper.options.logUsage) {
              aiHelper.logUsage(req, usage);
            }
          };

          if (!prompt.length) {
            throw self.apos.error('invalid');
          }

          // Fake results for cheap & offline testing
          if (process.env.APOS_AI_HELPER_MOCK) {
            const now = new Date();
            const images = [];
            for (let i = 0; i < 4; i++) {
              images.push({
                _id: createId(),
                userId: req.user._id,
                createdAt: now,
                prompt,
                url: self.apos.asset.url('/modules/@apostrophecms/ai-helper-image/placeholder.jpg'),
                // Mock metadata to simulate real provider responses
                providerMetadata: {
                  model: 'mock-image-1',
                  usage: {
                    prompt_tokens: 12,
                    total_tokens: 12
                  },
                  size: '1024x1024',
                  quality: 'standard'
                }
              });
            }

            await emitUsage({
              providerLabel: 'Mock Provider',
              providerMetadata: images[0] && images[0].providerMetadata,
              count: images.length,
              variantOfId: variantOf || null
            });

            return { images };
          }

          try {
            // Get the configured image provider
            const { provider } = aiHelper.getImageProvider();

            // Options for future expansion (masks, seeds, styles, etc.)
            const options = {};

            let result;

            if (variantOf) {
              // Check if provider supports variations
              if (!provider.capabilities.imageVariation) {
                throw self.apos.error('invalid',
                  `Provider "${aiHelper.options.imageProvider}" does not support image variations`
                );
              }

              // Generate variations
              const existing = await self.aiHelperImages.findOne({ _id: variantOf });
              if (!existing) {
                throw self.apos.error('notfound');
              }

              /**
               * Pass the image record to the provider so it can prepare it as needed.
               *
               * The provider is responsible for:
               * - Fetching the image (using self.aiHelperImageUrl(req, existing))
               * - Converting to required format
               * (e.g., OpenAI needs RGBA PNG, others may differ)
               * - Resizing if needed (e.g., Ollama might want 512x512)
               *
               * This keeps provider-specific requirements in the provider modules.
               *
               * Future options could include:
               * - mask: base64 image for inpainting
               * - maskArea: {x, y, width, height} for region editing
               * - negativePrompt: what to avoid in the generation
               * - seed: for reproducible results
               * - style: provider-specific style hints
               */
              result = await provider.generateImageVariation(
                req, existing, prompt, options
              );
            } else {
              /**
               * Generate new images from prompt
               *
               * Future options could include:
               * - numberOfImages: override default count
               * - size: image dimensions
               * - quality: generation quality level
               * - style: artistic style hints
               * - negativePrompt: what to avoid
               */
              result = await provider.generateImage(req, prompt, options);
            }

            // Validate provider response is in standard format
            const validatedResults = self.validateProviderResponse(result);

            // Store results in database and prepare response
            const images = [];
            const now = new Date();

            for (const item of validatedResults) {
              const id = createId();
              const image = {
                _id: id,
                userId: req.user._id,
                createdAt: now,
                uploadfs: item.type === 'base64',
                prompt,
                // Store any provider-specific metadata
                ...(item.metadata && Object.keys(item.metadata).length > 0 && {
                  providerMetadata: item.metadata
                })
              };

              // If base64, store in uploadfs
              if (item.type === 'base64') {
                await self.aiHelperWriteImageToUploadfs(image, item.data);
                await self.aiHelperImages.insertOne(image);
              } else {
                // URL-based image
                await self.aiHelperImages.insertOne({
                  ...image,
                  url: item.data
                });
              }

              // Ensure URL for response
              image.url = self.aiHelperImageUrl(req, image);
              images.push(image);
            }

            if (images.length > 0) {
              await emitUsage({
                providerLabel: provider.label,
                providerMetadata: images[0].providerMetadata || {},
                count: images.length,
                variantOfId: variantOf || null
              });
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
              if (temp) {
                await fsp.unlink(temp);
              }
              if (tempJpg) {
                await fsp.unlink(tempJpg);
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

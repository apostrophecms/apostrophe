# ai-helper: AI for content creation in Apostrophe 3

## Purpose

This module enhances Apostrophe with AI-driven helpers. Currently this module offers:

* A button to generate an image from a text prompt via OpenAI.
* An insert menu option to generate rich text from a prompt via OpenAI.

You will need to [obtain your own API key from OpenAI](https://openai.com/api/). To generate images using the default
model you will need to verify your organization in your OpenAI account.

## Caveats

This is a beta module where we are experimenting with simple ways to integrate generative AI in the
content creation process. AI systems can generate surprising and sometimes inappropriate results.
The OpenAI API itself is subject to change.

## Install

```bash
npm install @apostrophecms/ai-helper
```

```javascript
// in app.js
modules: {
  '@apostrophecms/ai-helper': {
    // Optional: specify a particular GPT model name.
    // This is the default:
    textModel: 'gpt-5.1',
    // Optional: specify a particular image generation model.
    // This is the default:
    imageModel: 'gpt-image-1-mini',
    // Optional: override the maximum number of tokens,
    // up to GPT's limit for the model. This is the default:
    textMaxTokens: 1000
  }
}
```

```javascript
// Anywhere you have a rich text widget that should support
// AI-generated rich text
someAreaName: {
  widgets: {
    '@apostrophecms/rich-text': {
      toolbar: [
        'styles',
        'bold'
      ],
      insert: [
        'ai'
      ],
      // Generated text includes headings if asked for
      styles: [
        {
          name: 'Heading',
          tag: 'h2'
        },
        {
          name: 'Subheading',
          tag: 'h3'
        },
        {
          name: 'Paragraph',
          tag: 'p'
        }
      ]
    }
  }
}
```


```javascript
// in modules/@apostrophecms/security-headers/index.js,
// only if you are using that module in your project
module.exports = {
  options: {
    policies: {
      ai: {
        // Images served by OpenAI, for editing purposes only
        'img-src': '*.blob.core.windows.net'
      }
    }
  }
};
```

## Run

```bash
export APOS_OPENAI_KEY=get-your-own-key-from-openai
node app
```

## Usage

### Image Generation

Add an image widget to the page. Click the edit pencil, then "Browse" as you normally would.

When the media manager appears, click the "🤖" (robot) button in the upper right corner.

When the "Generate Image" dialog appears, follow the instructions to enter a plain English
description of the image you want. Then click "Generate." After a pause, four images
will appear. You can do this as many times as you wish.

When you are happy with the results, click on the best of the four images to review it
and click "Select" to bring it into the media library, "Variants" to generate
variants of it, or "Delete" to discard it.

The image helper generates 1024x1024 images. This is the maximum size supported by OpenAI.
As of this writing, smaller images are not much cheaper, and are unlikely to look good
in various placements on a website.

Note that generated images not selected for use in the media library after one hour will
be discarded by OpenAI. Those you select are permanently imported to the media library.

### Text Generation

Configure a rich text widget with the `insert` subproperty configured as shown above.

Now press the "/" (slash) key at the start of any line to bring up the insert menu.
Choose "Generate Text" to generate text.

Enter a prompt as suggested and click "Generate." After a pause, the generated text
is inserted into the rich text widget.

Note that the generated text can include headings and links if you so request.
It is also a good idea to specify a word count. You can make your request using
ordinary conversational language.

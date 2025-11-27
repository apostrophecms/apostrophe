<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Form Builder for ApostropheCMS</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/form/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

**Let content teams build and manage forms without developer intervention.** Editors can create contact forms, surveys, applications, and registrations directly in the CMS, then place them anywhere on your site. Forms automatically handle submissions, email notifications, validation, and spam protection.

<!-- omit from toc -->
## Why Form Builder?

- **No-Code Form Creation**: Editors build forms through configurable field widgets—no tickets to developers
- **Automatic Data Collection**: Submissions saved to MongoDB with optional email notifications
- **🛡️ Built-in Security**: reCAPTCHA v3 integration and validation prevent spam
- **Design Freedom**: Custom CSS classes and styling hooks for brand consistency
- **Developer-Friendly**: Event hooks, custom validators, and extensible field types
- **Email Ready**: Route submissions to multiple recipients automatically

<!-- omit from toc -->
## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
  - [Module Configuration](#module-configuration)
  - [How It Works](#how-it-works)
  - [Adding Form Widget to Areas](#adding-form-widget-to-areas)
  - [Editor Workflow](#editor-workflow)
- [Configuration](#configuration)
  - [Main Module Options](#main-module-options)
  - [Available Field Types](#available-field-types)
- [Handling Submissions](#handling-submissions)
  - [Database Storage](#database-storage)
  - [Email Notifications](#email-notifications)
  - [Server-Side Events](#server-side-events)
  - [Browser Events](#browser-events)
    - [Success Event](#success-event)
    - [Failure Event](#failure-event)
- [reCAPTCHA Integration](#recaptcha-integration)
  - [Configuration Options](#configuration-options)
- [Styling](#styling)
  - [Custom CSS Classes](#custom-css-classes)
- [Field-Specific Options](#field-specific-options)
  - [Select Field](#select-field)
  - [File Upload Field](#file-upload-field)
- [Custom Field Validation](#custom-field-validation)
  - [Extending Collectors with the Super Pattern](#extending-collectors-with-the-super-pattern)
  - [Example: Minimum Word Count Validation](#example-minimum-word-count-validation)
  - [Error Handling](#error-handling)
- [Use Cases](#use-cases)
- [💎 Ready for More?](#-ready-for-more)
  - [🚀 **Pro Features for Forms**](#-pro-features-for-forms)


## Installation

```bash
npm install @apostrophecms/form
```

## Usage

### Module Configuration

Configure the form modules in your `app.js` file:

```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    // Main form module (must come first)
    '@apostrophecms/form': {},
    // Form widget for adding forms to areas
    '@apostrophecms/form-widget': {},
    // Field widgets (include only the types you need)
    '@apostrophecms/form-text-field-widget': {},
    '@apostrophecms/form-textarea-field-widget': {},
    '@apostrophecms/form-select-field-widget': {},
    '@apostrophecms/form-radio-field-widget': {},
    '@apostrophecms/form-file-field-widget': {},
    '@apostrophecms/form-checkboxes-field-widget': {},
    '@apostrophecms/form-boolean-field-widget': {},
    '@apostrophecms/form-conditional-widget': {},
    '@apostrophecms/form-divider-widget': {},
    '@apostrophecms/form-group-widget': {}
  }
});
```

**Module order matters:** `@apostrophecms/form` must appear before the widget modules. Include only the field types you want editors to use.

### How It Works

The `@apostrophecms/form` module creates a new **piece-type** called "Forms" in your CMS. This means forms are content that editors create once and can reuse across multiple pages—just like blog posts or products. Create a "Contact Form" once, then place it on your contact page, footer, and sidebar using the form widget.

### Adding Form Widget to Areas

To let editors add forms to a page or piece-type, include the form widget in an area:

```javascript
// modules/contact-page/index.js
export default {
  extend: '@apostrophecms/piece-page-type',
  options: {
    label: 'Contact Page'
  },
  fields: {
    add: {
      contactForm: {
        type: 'area',
        options: {
          max: 1,
          widgets: {
            '@apostrophecms/form': {}
          }
        }
      }
    },
    group: {
      basics: {
        fields: ['contactForm']
      }
    }
  }
};
```

### Editor Workflow

Once configured, editors can create and manage forms:

1. **Create a form**: Click "Forms" in the admin bar and create a new form (e.g., "Contact Form")
2. **Build the form**: Add field widgets (text fields, email, checkboxes, etc.) and configure options
3. **Configure submission handling**: Set up email notifications and confirmation messages in the "After-Submission" tab
4. **Place the form**: Edit any page with a form area, add the form widget, and select your created form

Editors can now create and manage forms independently.

## Configuration

### Main Module Options

Configure `@apostrophecms/form` with these options:

| Property | Type | Description |
|---|---|---|
| `disableOptionalLabel` | Boolean | Removes "(Optional)" text from optional fields. Default: `false` |
| `formWidgets` | Object | Widget configuration for allowed field types in forms |
| `saveSubmissions` | Boolean | Set to `false` to prevent saving submissions to MongoDB. Default: `true` |
| `emailSubmissions` | Boolean | Set to `false` to hide email notification fields. Default: `true` |
| `recaptchaSecret` | String | Secret key from reCAPTCHA site configuration |
| `recaptchaSite` | String | Site key for reCAPTCHA integration |
| `classPrefix` | String | Namespace for CSS classes on form elements |

### Available Field Types

The `formWidgets` option controls which widgets editors can use when building forms. Configure this in your project-level `/modules/@apostrophecms/form/index.js` file to override the built-in defaults. This is a **global setting** that applies to all forms in your project.

Default configuration:

```javascript
// modules/@apostrophecms/form/index.js
export default {
  options: {
    formWidgets: {
      '@apostrophecms/form-text-field': {},
      '@apostrophecms/form-textarea-field': {},
      '@apostrophecms/form-boolean-field': {},
      '@apostrophecms/form-select-field': {},
      '@apostrophecms/form-radio-field': {},
      '@apostrophecms/form-checkboxes-field': {},
      '@apostrophecms/form-conditional': {},
      '@apostrophecms/form-divider': {},
      '@apostrophecms/rich-text': {
        toolbar: [
          'styles', 'bold', 'italic', 'link',
          'orderedList', 'bulletList'
        ]
      }
    }
  }
};
```

The rich text widget allows editors to add instructions within forms. Any widget type can be included in this configuration.

> **Need different field types for different forms?** The `formWidgets` option is global and cannot be set per-area or per-page. If you need separate sets of allowed fields (for example, a simple contact form vs. a detailed application form), extend the `@apostrophecms/form` module to create a second form piece-type with its own `formWidgets` configuration. **However**, without additional controls, all editors can use both form types. Use [`@apostrophecms-pro/advanced-permission`](https://github.com/apostrophecms/advanced-permission) to restrict which user groups can create and manage each form type—ensuring junior editors only access basic forms while senior staff can use advanced forms. [Learn more about Pro features](#-ready-for-more).

## Handling Submissions

### Database Storage

Submissions are automatically saved to the `aposFormSubmissions` MongoDB collection. To disable database storage:

```javascript
// modules/@apostrophecms/form/index.js
export default {
  options: {
    saveSubmissions: false
  }
};
```


### Email Notifications

If `@apostrophecms/email` is configured, forms can automatically email submissions to multiple recipients. In the form editor, navigate to the "After-Submission" tab and enter comma-separated email addresses in the "Email Address(es) for Results" field.

To hide email notification fields:

```javascript
// modules/@apostrophecms/form/index.js
export default {
  options: {
    emailSubmissions: false
  }
};
```

> **📧 Email Configuration**: To send form submissions via email, you must first configure the `@apostrophecms/email` module. See the [email configuration guide](https://docs.apostrophecms.org/guide/sending-email.html) for setup instructions. Forms can still save submissions to the database without email configuration.

### Server-Side Events

Form submissions trigger events you can handle in your code for custom processing, integrations, or modifying submission data. For example, you could send submissions to an external CRM, add server-side metadata like query parameters, or trigger custom workflows.

**`submission` event** - Fires on every form submission:

```javascript
// modules/@apostrophecms/form/index.js
export default {
  handlers(self) {
    return {
      'submission': {
        async handleSubmission(req, form, submission) {
          // Your custom logic here
          console.log('Form submitted:', form.title);
          console.log('Data:', submission);
        }
      }
    };
  }
};
```

**`beforeSaveSubmission` event** - Fires before saving the `info.submission` to the database (if enabled):

```javascript
// modules/@apostrophecms/form/index.js
export default {
  handlers(self) {
    return {
      'beforeSaveSubmission': {
        async modifySubmission(req, info) {
          // Modify info.submission before it's saved
          info.submission.processedAt = new Date();
        }
      }
    };
  }
};
```

Event handler arguments:

| Event | Arguments | Description |
|---|---|---|
| `submission` | `req`, `form`, `submission` | Request object, form document, submission data |
| `beforeSaveSubmission` | `req`, `info` | Request object, object with `form`, `data`, and `submission` properties |

### Browser Events

The form module emits browser events on the `body` element after a submission attempt. You can listen for these to add **custom client-side feedback or analytics**.

#### Success Event

`@apostrophecms/form:submission-form`
Fires when a submission is successfully processed. The event detail includes a `form` property.

```js
document.body.addEventListener('@apostrophecms/form:submission-form', e => {
  // e.detail.form contains the form element/config
  console.log('Form submitted successfully:', e.detail.form);

  // Example: show a toast notification
  apos.notify('✅ Thanks for your submission!', { type: 'success' });

  // Example: send analytics event
  gtag('event', 'form_submission', {
    formTitle: e.detail.form.title || 'Untitled Form'
  });
});
```
#### Failure Event

`@apostrophecms/form:submission-failed`
Fires when a submission fails due to validation errors, spam protection, or server issues. The event detail includes a `formError` property.

```js
document.body.addEventListener('@apostrophecms/form:submission-failed', e => {
  // e.detail.formError contains the error info
  console.error('Form submission failed:', e.detail.formError);

  // Example: show a custom error banner
  apos.notify('⚠️ Something went wrong. Please try again.', { type: 'danger' });

  // Example: track failed attempts
  gtag('event', 'form_submission_failed', {
    error: e.detail.formError.message || 'Unknown'
  });
});
```
**Use Cases**
* Replace the default "thank you" UI with a custom success message
* Push events into Google Tag Manager, Segment, or other analytics
* Redirect or scroll the page after a successful submission
* Display tailored error messages on failure

> **Note:** Forms already support built-in after-submission messages (`thankYouHeading`, `thankYouBody`) and inline error handling. You only need these browser events if you want extra client-side behavior beyond what the module provides out of the box.

## reCAPTCHA Integration

Protect forms from spam with Google reCAPTCHA v3. Set up reCAPTCHA at [google.com/recaptcha](https://www.google.com/recaptcha/) using version 3, then configure your site and secret keys.

### Configuration Options

**Option 1: Hard-code in module configuration**

```javascript
// modules/@apostrophecms/form/index.js
export default {
  options: {
    recaptchaSecret: 'YOUR_SECRET_KEY',
    recaptchaSite: 'YOUR_SITE_KEY'
  }
};
```

**Option 2: Allow editors to configure in UI**

If you don't hard-code both keys, a global settings UI appears where admins can enter them. Once configured, each form has a checkbox to enable reCAPTCHA independently.

## Styling

### Custom CSS Classes

Add your own class prefix to form elements for complete styling control:

```javascript
// modules/@apostrophecms/form/index.js
export default {
  options: {
    classPrefix: 'my-form'
  }
};
```

This generates BEM-style classes like `my-form__input`, `my-form__label`, and `my-form__error` on form elements.

For teams who prefer visual design tools, the [Palette extension](https://apostrophecms.com/extensions/palette-extension) allows in-context CSS customization without writing code. [Learn more about Pro features](#-ready-for-more).

## Field-Specific Options

### Select Field

The select field widget supports multiple selections:

```javascript
// modules/@apostrophecms/form-select-field-widget/index.js
export default {
  options: {
    allowMultiple: true  // Default: false
  }
};
```

When enabled, two additional fields appear in the widget schema:

| Property | Type | Description | Default |
|---|---|---|---|
| `allowMultiple` | Boolean | Enable multiple selections. | `false` |
| `size` | Integer | Number of visible options. Set to `0` to use the default compact dropdown; set to `2` or higher to render a listbox showing that many options at once. | `0` |

### File Upload Field

⚠️ **Security Warning**: File upload fields allow any visitor to upload files to your server, creating potential risks for storage abuse and malicious uploads. This widget is **not included by default**—you must explicitly enable it.

**Where to implement security measures:**

1. **Storage provider level** (AWS S3, Google Cloud Storage, Azure Blob):
   - Configure file type restrictions, size limits, and lifecycle policies in your provider's console
   - Set up bucket quotas and alerts for unusual upload patterns
   - See your provider's documentation for content validation features

2. **ApostropheCMS attachment module** (`modules/@apostrophecms/attachment/index.js`):
   ```javascript
   export default {
     options: {
       // Restrict file types (extension allowlist)
       fileGroups: [
         {
           name: 'images',
           extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
           extensionMaps: {},
           contentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
         },
         {
           name: 'office',
           extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
           contentTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
         }
       ],
       // Set maximum file size (in bytes)
       maximumUploadSize: 10485760  // 10MB
     }
   };
   ```
   See the [attachment module documentation](https://docs.apostrophecms.org/reference/modules/attachment.html) for complete configuration options.

3. **Form submission handler** (for additional validation):
   ```javascript
   // modules/@apostrophecms/form/index.js
   export default {
     handlers(self) {
       return {
         'beforeSaveSubmission': {
           async validateFiles(req, info) {
             // Add custom file validation logic here
             // Access uploaded files via info.data
           }
         }
       };
     }
   };
   ```

4. **Spam protection**: Enable reCAPTCHA v3 (see [reCAPTCHA Integration](#recaptcha-integration) section)

Files are stored in your configured attachment storage (local uploads or cloud bucket). Form submissions save attachment URLs, not the files themselves.

**Multiple file uploads**: Like the select field, the file field widget supports an `allowMultiple` option:

```javascript
// modules/@apostrophecms/form-file-field-widget/index.js
export default {
  options: {
    allowMultiple: true  // Default: false
  }
};
```

When enabled, users can select and upload multiple files in a single form submission.

## Custom Field Validation

Need business-specific rules like minimum word counts, format requirements, or cross-field dependencies? Extend the built-in field collectors to add custom validation logic before submission. This runs client-side for immediate feedback without server round-trips.

Each field returns its value from a collector function located on the `apos.aposForm.collectors` array in the browser. You can extend these collector functions to adjust the value or do additional validation before the form posts to the server. Collector functions can be written as asynchronous functions if needed.

Collector functions take the widget element as an argument and return a response object on a successful submission. The response object properties are:

| Property | Description |
|---|---|
| `field` | The field element's `name` attribute (identical to the field widget's `name` property) |
| `value` | The field value |

### Extending Collectors with the Super Pattern

These functions can be extended for project-level validation using the super pattern. This involves:

1. Assigning the original function to a variable
2. Creating a new function that uses the original one, adds functionality, and returns an identically structured response
3. Assigning the new function to the original function property

### Example: Minimum Word Count Validation

```javascript
// modules/@apostrophecms/form-textarea-field-widget/ui/src/index.js

export default () => {
  const TEXTAREA_WIDGET = '@apostrophecms/form-textarea-field';

  // 1️⃣ Store the original collector function on `superCollector`.
  const superCollector = apos.aposForm.collectors[TEXTAREA_WIDGET].collector;

  // 2️⃣ Create a new collector function that accepts the same widget element
  // parameter.
  function newCollector(el) {
    // Get the response from the original collector.
    const response = superCollector(el);

    if (response.value && response.value.split(' ').length < 10) {
      // Throwing an object if there are fewer than ten words.
      throw {
        field: response.field,
        message: 'Write at least 10 words'
      };
    } else {
      // Returning the original response if everything is okay.
      return response;
    }
  }

  // 3️⃣ Assign our new collector to the original property.
  apos.aposForm.collectors[TEXTAREA_WIDGET].collector = newCollector;
};
```

### Error Handling

If you want to indicate an error on the field, `throw` an object with the following values (as shown above):

| Property | Description |
|---|---|
| `field` | The field element's `name` attribute (identical to the field widget's `name` property) |
| `message` | A string to display on the field as an error message |

## Use Cases

**Contact Forms**: Let teams create department-specific contact forms without developer involvement.

**Lead Generation**: Build conversion-optimized forms with conditional fields and reCAPTCHA protection.

**Event Registration**: Collect attendee information with file uploads for documents or photos.

**User Feedback**: Create surveys and feedback forms that route to appropriate team members.

**Job Applications**: Accept resumes and application materials with validation and email routing.

## 💎 Ready for More?

The open-source form builder provides powerful form creation capabilities, but enterprise teams often need advanced control and workflow features. [**ApostropheCMS Pro**](https://apostrophecms.com/pro) extends form functionality with professional-grade features:

### 🚀 **Pro Features for Forms**

- **🔐 Advanced Permissions** - Control which teams can create, edit, and manage specific form types. Restrict access to sensitive forms like HR applications or customer data collection. Perfect for multi-team organizations that need different form capabilities for different departments.

- **🌍 Automated Translation** - Automatically translate forms and confirmation messages into multiple languages with AI-powered translation services (DeepL, Google Translate, Azure). Deploy multilingual forms without manual translation work.

- **📄 Document Management** - Version control for forms with complete audit trails. Track changes to form fields, restore previous versions, and maintain compliance with form modification history.

- **🎨 Visual Design Tools** - Use the Palette extension for in-context CSS customization of form styling without writing code. Perfect for teams without dedicated frontend developers.

Create an account on Apostrophe Workspaces and upgrade to [**ApostropheCMS Pro**](https://app.apostrophecms.com/login) or **[contact our team](https://apostrophecms.com/contact-us)** to learn about Pro licensing and access enterprise features that enhance form management, compliance, and team collaboration.

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/form">Give us a star on GitHub!</a> ⭐</strong></p>
</div>
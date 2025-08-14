<div align="center">
  <a href="https://github.com/apostrophecms/apostrophe">
    <img src="logo.svg" alt="ApostropheCMS logo" width="80" height="80">
  </a>

  <h1>ApostropheCMS</h1>

  <p>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20" />
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/apostrophe/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639" />
    </a>
  </p>

  <p>
    <strong>Full-stack CMS for developers and content teams</strong><br />
    Build websites with in-context editing and headless flexibility using Node.js and MongoDB.
    <br />
    <a href="https://docs.apostrophecms.org/"><strong>Documentation »</strong></a>
    <br />
    <br />
    <a href="http://demo.apostrophecms.com">Demo</a>
    ·
    <a href="https://productlane.com/edit-roadmap">Roadmap</a>
    ·
    <a href="https://github.com/apostrophecms/apostrophe/issues/new?assignees=&labels=bug,3.0&template=bug_report.md&title=">Report Bug</a>
  </p>
</div>

## About

ApostropheCMS is a full-stack content management system built with Node.js and MongoDB. Content creators can edit directly on live pages without switching between admin interfaces, while developers can build with modern JavaScript or use it headlessly with any frontend framework.

### Key Features

- **🎯 In-Context Editing** - Content creators edit directly on the live page, seeing changes instantly
- **⚡ Headless-Ready** - Use any frontend framework while keeping the powerful admin experience
- **🛠️ Developer-First** - Built with Node.js and MongoDB for full-stack JavaScript development
- **📈 Scales Beautifully** - From small sites to enterprise applications handling millions of pages
- **🔐 Enterprise Features** - Advanced permissions, workflow management, automated translations, and more

## System Requirements

| Requirement | Version | Installation Notes |
|-------------|---------|-------------------|
| **Node.js** | 20.x+ | Use [NVM](https://github.com/nvm-sh/nvm) for version management |
| **MongoDB** | 6.0+ | [MongoDB Atlas](https://www.mongodb.com/atlas) (cloud) or local install |
| **npm** | 10.x+ | Included with Node.js |

See our [setup guides](https://docs.apostrophecms.org/guide/development-setup.html) for installation instructions.

## Quick Start

Get ApostropheCMS running locally in minutes:

```bash
# Option 1: Install CLI globally (recommended for multiple projects)
npm install -g @apostrophecms/cli
apos create my-website
cd my-website
npm run dev

# Option 2: Use npx for one-time project creation
npx @apostrophecms/cli create my-website
cd my-website
npm run dev
```

Your new ApostropheCMS site will be available at `http://localhost:3000` with a powerful admin interface at `/login`.

### Prefer to Go Headless?

**Get started with Astro integration** - the easiest way to build headless sites while keeping visual editing:

- **[Apollo Starter Kit (Astro)](https://apostrophecms.com/starter-kits/apollo-starter-kit-for-astro-cms)** - Production-ready foundation with beautiful design system and rich content features
- **[Essentials Starter Kit (Astro)](git clone https://github.com/apostrophecms/starter-kit-astro-essentials)** - Minimal, clean foundation for building custom designs from scratch

Both starter kits provide headless CMS power with in-context editing, letting content creators edit directly on the live site while you build with modern frontend tools. Our Astro integration handles all the content fetching automatically—no REST API calls to write.

**Desire a different frontend framework?** Use our REST APIs with React, Vue, Svelte, or any other framework:

- **[REST API Documentation](https://docs.apostrophecms.org/reference/api/pieces.html)** - Complete API reference
- **[Headless CMS Guide](https://docs.apostrophecms.org/guide/headless-cms.html)** - Integration walkthrough for any framework

### Hosting & Deployment

Choose [ApostropheCMS hosting](https://apostrophecms.com/hosting) for turnkey solutions with optimized performance and dedicated support, or deploy to [any platform where Node.js runs](https://docs.apostrophecms.org/guide/hosting.html).

## Built With Modern Tech

- **[Node.js](https://nodejs.org/)** - JavaScript runtime for server-side development
- **[MongoDB](https://www.mongodb.com/)** - Flexible document database for content storage
- **ESM Modules** - Native ES6 module support for modern JavaScript
- **Vite** - Lightning-fast build tool and development server
- **Modern JavaScript** - ES6+, async/await, and contemporary development patterns

## Community & Support

**Join other developers and content creators using ApostropheCMS:**

- **[Discord](https://discord.com/invite/XkbRNq7)** - Get help, share projects, and connect with other users
- **[GitHub Discussions](https://github.com/apostrophecms/apostrophe/discussions)** - Feature requests, technical discussions, and community support
- **[Documentation](https://docs.apostrophecms.org/)** - Comprehensive guides, tutorials, and API references

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help makes ApostropheCMS better for everyone.

- **[Contribution Guide](https://github.com/apostrophecms/apostrophe/blob/main/CONTRIBUTING.md)** - How to contribute code, documentation, and feedback
- **[Good First Issues](https://github.com/apostrophecms/apostrophe/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)** - Perfect starting points for new contributors


## Pro Features

**For teams and organizations requiring additional features:**

- **🔐 Advanced User Management** - Granular permissions, user groups, and access controls
- **🌍 Automated Translation** - AI-powered translation with DeepL, Google Translate, and Azure
- **📊 Analytics & SEO** - Built-in SEO optimization and content analytics
- **⚡ Performance Optimization** - Advanced caching, CDN integration, and performance monitoring
- **🏢 Multisite Management** - Manage multiple sites from a single dashboard with shared resources
- **💼 Professional Support** - Dedicated support, training, and consultation services

[Explore all the pro extensions](https://apostrophecms.com/extensions?autocomplete=&license=assembly&license=pro) and [sign up](https://app.apostrophecms.com/login) for a Pro license in our self-service Apostrophe Workspaces, or [contact us](https://apostrophecms.com/contact-us) to learn about licensing and support options.

## License

ApostropheCMS is open source software licensed under the [MIT License](https://github.com/apostrophecms/apostrophe/blob/main/LICENSE.md). This means you're free to use, modify, and distribute it for both personal and commercial projects.

---

<div align="center">
  <p>
    <strong>Ready to build something amazing?</strong><br>
    <a href="https://docs.apostrophecms.org/">Get started with our documentation</a> or <a href="https://apostrophecms.com/contact-us">talk to our team</a>
  </p>
  <p>
    <em>Built with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS team</a></em>
  </p>
</div>
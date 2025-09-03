<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>ApostropheCMS OpenAPI Specification</h1>

  <p>
    <a aria-label="Apostrophe logo" href="https://docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/apostrophecms-openapi/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

**Build robust integrations with confidence** using the official OpenAPI 3.1 specification for the ApostropheCMS REST API. Generate type-safe SDKs, explore endpoints interactively, and accelerate development with standardized API documentation.

## Why ApostropheCMS OpenAPI?

- **🚀 Rapid SDK Generation**: Create client libraries in TypeScript, PHP, Python, Java, and more
- **📚 Interactive Documentation**: Explore and test API endpoints with built-in Swagger UI
- **🛠️ Developer Experience**: Type-safe client code with auto-completion and validation
- **⚡ Headless Ready**: Perfect for modern frontend frameworks and mobile applications
- **🎯 Standards Compliant**: OpenAPI 3.1 specification for maximum tool compatibility
- **🔍 API Discovery**: Comprehensive endpoint documentation with examples and schemas

> ⚠️ **Important**: This repository contains the API specification, not ApostropheCMS itself. For the CMS, visit the [main ApostropheCMS repository](https://github.com/apostrophecms/apostrophe).

## What's Included

### Core Specification
- **`apostrophecms-openapi.yaml`** - Complete, validated OpenAPI spec covering all core, public facing ApostropheCMS REST API endpoints
- **Interactive documentation** with request/response examples
- **Authentication schemas** for API keys and bearer tokens
- **Comprehensive error responses** and status codes

### Examples
- **`examples/apostrophecms-piece-examples.yaml`** - Sample piece types (articles, events) for learning and prototyping
- **`examples/typescript/`** - Pre-generated TypeScript SDK with comprehensive documentation

## Quick Start

### View Interactive Documentation

To explore the API with Swagger UI, first install the dependencies with `npm install` and then:

```bash
# Core ApostropheCMS API
npm run docs:open

# or

# Example piece types
npm run example-docs:open
```

This opens an interactive browser interface where you can test your project endpoints, view schemas, and understand the API structure.

### Generate Your First SDK

1. Generate a JavaScript/TypeScript client (requires Java runtime):

    ```bash
    npm run generate:typescript
    ```

This will create an SDK folder for Typescript in your `examples` folder. You can leave it in that location, or move it to a more accessible location.

2. In the `typescript` folder, run:

    ``` bash
    npm install
    npm run build
    ```

> 📚 **Rich Documentation Included**: The generated TypeScript SDK comes with complete API documentation in the `docs/` folder, plus a comprehensive README with examples for every endpoint. This is created by the generator.

3. Install the generated client in your project using the full (not relative) path:

    ```bash
    npm install /Volume/development/apostrophecms-openapi/examples/typescript
    ```
4. Start your local ApostropheCMS project

5. Use it:

```ts
import 'dotenv/config';
import { Configuration, PagesApi, UsersApi } from 'apostrophecms-client';

const config = new Configuration({
  basePath: process.env.APOSTROPHE_BASE_URL || 'http://localhost:3000/api/v1',
  apiKey: process.env.APOSTROPHE_API_KEY || 'your-api-key-here'
});

// Resource‑scoped clients
const pages = new PagesApi(config);
const users = new UsersApi(config);

async function run() {
  // --- Pages ---
  // GET /@apostrophecms/page (page tree)
  const tree = await pages.pageGet();
  console.log('Page tree:', tree.data);

  // POST /@apostrophecms/page (create)
  const createdPage = await pages.pagePost({
    title: 'Welcome Page',
    type: 'default-page',
    slug: 'welcome'
  });
  console.log('Created page:', createdPage.data);

  // --- Users ---
  // GET /@apostrophecms/user (list)
  const userList = await users.userList();
  console.log('Users:', userList.data);

  // POST /@apostrophecms/user (create)
  const createdUser = await users.userCreate({
    title: 'api-user',
    username: 'api-user',
    password: 'Str0ng!',
    role: 'admin', // or 'edit', 'guest', etc.
    email: 'api-user@email.com'
  });
  console.log('Created user:', createdUser.data);
}

run().catch(err => {
  console.error(err?.response?.data ?? err.message);
});
```

## Authentication

The API supports multiple authentication methods:

### API Keys
```javascript
const config = new Configuration({
  basePath: 'http://localhost:3000/api/v1',
  apiKey: 'your-api-key-here'
});
```

### Bearer Tokens
```javascript
const config = new Configuration({
  basePath: 'http://localhost:3000/api/v1',
  accessToken: 'your-jwt-token'
});
```

### Session-based Authentication
For browser-based applications, you can use standard session cookies alongside the API.
```javascript
const cfg = new Configuration({ basePath, accessToken: process.env.APOS_BEARER });
```

* **API key** (query string): pass `apiKey` into `Configuration({ apiKey: '…' })`
* **Bearer token**: pass `accessToken` into `Configuration({ accessToken: '…' })`
* **Session/cookie**: run in an environment that includes the session cookie and enable `withCredentials` (axios) if needed

## SDK Generation

These scripts wrap the OpenAPI Generator (requires a Java runtime). Adjust paths/options as needed.

### TypeScript / JavaScript (axios)

```bash
npm run generate:typescript
```

**What you get**

* Works in JS **and** TS projects
* axios‑based HTTP client (modern `async/await`)
* Typed request/response models in TypeScript

### PHP (target WordPress migrations & LAMP)

```bash
npm run generate:php
```

**What you get**

* Composer‑friendly PHP client
* Good fit for WordPress → ApostropheCMS migration scripts
* Server‑rendered apps and legacy integrations

### Python (ETL & scripting)

```bash
npm run generate:python
```

**What you get**

* Easy scripting for data migration/ETL
* Strong fit for analytics/reporting or ops automation

### Other languages

See all supported generators: [https://openapi-generator.tech/docs/generators/](https://openapi-generator.tech/docs/generators/)

## Validation & Testing

Ensure specification quality with built-in validation:

```bash
# Validate OpenAPI structure
npm run validate

# Lint against best practices
npm run lint

# Run both validation and linting
npm run test
```

The specification uses [Spectral](https://stoplight.io/open-source/spectral/) for comprehensive linting and follows OpenAPI best practices for consistency and reliability. Different OpenAPI validators may show varying warnings since each tool enforces its own additional rules beyond the core specification.

## API Mocking

Use the specification for local development and testing:

```bash
# Install Prism globally
npm install -g @stoplight/prism-cli

# Start a mock server
prism mock apostrophecms-openapi.yaml

# Mock server runs at http://localhost:4010
```

This creates a fully functional mock API server that returns example responses, perfect for frontend development before your backend is ready.

## Versioning

- **Specification Version**: Follows semantic versioning (current: `1.0.0`)
- **API Compatibility**: The `x-apostrophe.cmsVersion` field indicates compatible ApostropheCMS versions
- **Breaking Changes**: Major version updates indicate breaking API changes

## Advanced Usage

### Custom Configuration

Override default client configuration:

```javascript
// Works in both JavaScript and TypeScript
const config = new Configuration({
  basePath: 'https://your-cms.com/api/v1',
  apiKey: 'your-api-key',
  // Custom timeout
  timeout: 10000,
  // Custom headers
  defaultHeaders: {
    'Custom-Header': 'value'
  }
});
```

### Error Handling

Handle API errors gracefully:

```javascript
try {
  const page = await api.getApostrophecmsPageById('page-id');
} catch (error) {
  if (error.response?.status === 404) {
    console.log('Page not found');
  } else if (error.response?.status === 401) {
    console.log('Authentication required');
  } else {
    console.error('API Error:', error.message);
  }
}
```

### Pagination

Handle paginated responses:

```javascript
const fetchAllPages = async () => {
  let page = 1;
  const allPages = [];

  while (true) {
    const response = await api.getApostrophecmsPage(page, 50);
    allPages.push(...response.data.results);

    if (response.data.results.length < 50) break;
    page++;
  }

  return allPages;
};
```

## File Structure

```
├── apostrophecms-openapi.yaml     # Core API specification
├── examples/
│   ├── apostrophecms-piece-examples.yaml  # Example piece types
│   └── typescript/                # Generated TypeScript SDK
├── scripts/
│   ├── serve-docs.js             # Swagger UI server
│   └── serve-example-docs.js     # Example docs server
└── package.json                  # Build scripts and dependencies
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run docs:open` | Open interactive API documentation |
| `npm run example-docs:open` | Open example piece documentation |
| `npm run validate` | Validate OpenAPI specification |
| `npm run lint` | Lint specification with Spectral |
| `npm run test` | Run validation and linting |
| `npm run generate:typescript` | Generate TypeScript SDK |
| `npm run generate:python` | Generate Python SDK |
| `npm run generate:php` | Generate PHP SDK |

---

## Contributing

We welcome contributions to improve the specification:

1. **Fork the repository** and create a feature branch
2. **Make your changes** to the OpenAPI specification
3. **Run tests** with `npm test` to ensure validity
4. **Submit a pull request** with a clear description

Please ensure all changes:
- Follow OpenAPI 3.1 standards
- Include appropriate examples
- Pass validation and linting
- Update documentation if needed

## Getting Started with ApostropheCMS

New to ApostropheCMS? Check out these resources:

- **[ApostropheCMS Documentation](https://docs.apostrophecms.org/)** - Complete CMS guide
- **[REST API Tutorial](https://docs.apostrophecms.org/guide/rest-api.html)** - Learn the API basics
- **[Headless CMS Guide](https://docs.apostrophecms.org/guide/headless.html)** - Building decoupled applications

## Community & Support

- **[Discord Community](https://discord.com/invite/HwntQpADJr)** - Get help from other developers
- **[GitHub Issues](https://github.com/apostrophecms/apostrophecms-openapi/issues)** - Report bugs or request features
- **[Documentation](https://docs.apostrophecms.org/)** - Comprehensive guides and API reference
- **[Professional Support](https://apostrophecms.com/contact-us)** - Enterprise support and consulting

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/apostrophecms-openapi">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>
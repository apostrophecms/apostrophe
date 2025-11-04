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

The official OpenAPI 3.1 specification for the ApostropheCMS REST API.  Explore endpoints interactively, mock the API for rapid prototyping, or generate type-safe SDKs in your preferred language.

---

## What This Is (And Isn't)

This repository contains the **core ApostropheCMS OpenAPI specification** - the base REST API that every Apostrophe project inherits. It documents standard endpoints for pages, pieces, assets, users, and workflow management.

**Think of it as the foundation, not the complete building.** Your project likely has custom piece types (like products, events, or blog posts) and project-specific routes that aren't included here.

> ⚠️ **Important**: This repository contains the API specification, not ApostropheCMS itself. For the CMS, visit the [main ApostropheCMS repository](https://github.com/apostrophecms/apostrophe).

### For Your Own Project

To generate a specification that includes **both** core and your custom modules:

1. Install [@apostrophecms/openapi-generator](https://github.com/apostrophecms/openapi-generator) in your Apostrophe project
2. Run the generator from your project directory  
3. Use the generated specification for SDK creation and documentation specific to your application

### For Exploring Core ApostropheCMS

Use this repository to:

- **Explore the API** - Browse all core endpoints in interactive documentation
- **Design API contracts** - Use as a foundation for planning new projects and features
- **Mock for prototyping** - Build frontend apps before your backend is ready
- **Generate SDKs** - Create client libraries in TypeScript, Python, PHP, and more
- **Learn conventions** - Understand ApostropheCMS API patterns and best practices

---

## Getting Started

### Explore the API Interactively

View the complete API documentation with Swagger UI:

```bash
# Install dependencies
npm install

# Open interactive documentation
npm run docs:open
```

This opens a browser interface where you can browse endpoints, view schemas, and test API calls.

> **Note**: You will have to have an ApostropheCMS project running before testing the endpoints.

### Authenticate for Testing

You can authenticate in Swagger UI using either an API key or bearer token:

#### Option 1: API Key (Recommended)

The simplest method - requires one-time setup in your project:

1. **Add an API key** to your ApostropheCMS project in `modules/@apostrophecms/express/index.js`:

```javascript
export default {
  options: {
    apiKeys: {
      myTestKey: {
        role: 'admin'
      }
    }
  }
};
```

2. **In Swagger UI**: Click "Authorize" → scroll to "ApiKeyAuth" → enter `myTestKey`

3. **Test away**: Execute requests directly from the documentation

#### Option 2: Bearer Token

No project configuration needed - use your existing login credentials:

1. **Generate a token**: In Swagger UI, find the `POST /@apostrophecms/login/login` endpoint and execute it with:

```json
{
  "username": "your-username",
  "password": "your-password"
}
```

2. **Copy the token**: From the response, copy **only the token value** (not the full JSON). 
   - Example: if response is `{"token": "abc123xyz"}`, copy only `abc123xyz`

3. **Authorize**: Click "Authorize" → scroll to "BearerAuth" → paste the token value

The token will be automatically sent as `Authorization: Bearer {your-token}` with each request.

---

## API-First Development

Use this specification to design and prototype before writing code - perfect for parallel frontend/backend development.

### Design Your API Contract

When starting a new project or feature:

1. **Start with the core spec** as your foundation
2. **Manually add your custom endpoints** following the same patterns used in the core spec
3. **Share the spec** with your team as the contract between frontend and backend
4. **Develop in parallel** - frontend uses mocks, backend implements to match the spec

### Mock the API

Create a fully functional mock server without any backend code:

```bash
# Install Prism globally
npm install -g @stoplight/prism-cli

# Mock the core API
prism mock apostrophecms-openapi.yaml

# Or mock your project-specific spec
prism mock my-project-openapi.yaml

# Mock server runs at http://localhost:4010
```

The mock server returns realistic example responses, letting frontend developers build and test their applications before the backend is ready.

**Use cases:**
- Prototype new features without backend changes
- Frontend development while backend is in progress  
- Demo UIs to stakeholders before implementation
- Test frontend error handling and edge cases

> **Note:** The [@apostrophecms/openapi-generator](https://github.com/apostrophecms/openapi-generator) generates documentation for *existing* ApostropheCMS projects - it documents what you've already built. For true API-first design, you'd manually extend this core spec before implementation.

---

## Generate an SDK

Create a client library in your preferred language (requires Java runtime):

```bash
# TypeScript/JavaScript
npm run generate:typescript

# Python
npm run generate:python

# PHP
npm run generate:php
```

The generated SDK will be in the `examples/` folder, complete with documentation and usage examples.

---

## Using Generated SDKs

After generating an SDK, you'll find complete documentation in the generated folder including a README with examples for every endpoint.

### Quick TypeScript Example

```bash
# Build the SDK
cd examples/typescript
npm install && npm run build

# Install in your project
npm install /path/to/examples/typescript
```

Basic usage:

```typescript
import { Configuration, PagesApi } from 'apostrophecms-client';

const config = new Configuration({
  basePath: 'http://localhost:3000/api/v1',
  apiKey: process.env.APOSTROPHE_API_KEY
});

const pages = new PagesApi(config);

// Get page tree
const tree = await pages.pageGet();
console.log(tree.data);

// Create a page
const newPage = await pages.pagePost({
  title: 'Welcome',
  type: 'default-page',
  slug: '/welcome'
});
```

**See the generated `examples/typescript/README.md` for complete documentation**, including authentication options, error handling, and examples for all endpoints.

---

## What's Included

### Specifications

- **`apostrophecms-openapi.yaml`** - Core ApostropheCMS REST API specification
- **`examples/apostrophecms-piece-examples.yaml`** - Sample piece types for learning

### Generated Examples

- **`examples/typescript/`** - Pre-generated TypeScript SDK with full documentation
- Includes comprehensive README with examples for every endpoint

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run docs:open` | Open core API documentation |
| `npm run example-docs:open` | Open example piece documentation |
| `npm run validate` | Validate OpenAPI specification |
| `npm run lint` | Lint specification with Spectral |
| `npm test` | Run validation and linting |
| `npm run generate:typescript` | Generate TypeScript SDK |
| `npm run generate:python` | Generate Python SDK |
| `npm run generate:php` | Generate PHP SDK |

---

## Validation

Ensure specification quality:

```bash
npm run validate  # Check OpenAPI structure
npm run lint      # Lint with Spectral
npm test          # Run both checks
```

The specification follows OpenAPI 3.1 standards and uses [Spectral](https://stoplight.io/open-source/spectral/) for linting.

---

## SDK Generation Details

This repository uses [OpenAPI Generator](https://openapi-generator.tech/) to create client libraries. 

### Other Languages

```bash
# Python
npm run generate:python

# PHP
npm run generate:php

# See full list of supported languages:
# https://openapi-generator.tech/docs/generators/
```

Each generated SDK includes:
- Complete API client with type definitions
- README with usage examples
- Documentation for all endpoints
- Authentication configuration helpers

Check the generated SDK's README for language-specific setup and usage instructions.

---

## Contributing

We welcome contributions! To contribute:

1. Fork the repository and create a feature branch
2. Make changes to the OpenAPI specification
3. Run `npm test` to validate your changes
4. Submit a pull request with a clear description

Please ensure your changes:
- Follow OpenAPI 3.1 standards
- Include appropriate examples
- Pass validation and linting
- Update documentation as needed

---

## Resources

### ApostropheCMS Documentation
- [Main Documentation](https://docs.apostrophecms.org/)
- [REST API Guide](https://docs.apostrophecms.org/guide/rest-api.html)
- [Headless CMS Guide](https://docs.apostrophecms.org/guide/headless.html)
- [Main Repository](https://github.com/apostrophecms/apostrophe)

### Support & Community
- [Discord Community](https://discord.com/invite/HwntQpADJr) - Get help from other developers
- [GitHub Issues](https://github.com/apostrophecms/apostrophecms-openapi/issues) - Report bugs or request features
- [Professional Support](https://apostrophecms.com/contact-us) - Enterprise support and consulting

---

## Versioning

- **Specification Version**: Follows semantic versioning (current: `1.0.0`)
- **API Compatibility**: The `x-apostrophe.cmsVersion` field indicates compatible ApostropheCMS versions
- **Breaking Changes**: Major version updates indicate breaking API changes

---

<div align="center">
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team.</p>
  <p><strong>Found this useful? <a href="https://github.com/apostrophecms/apostrophecms-openapi">Give us a star!</a> ⭐</strong></p>
</div>
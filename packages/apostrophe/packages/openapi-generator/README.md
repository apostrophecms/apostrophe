<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80" />

  <h1>OpenAPI Generator for ApostropheCMS</h1>

  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20" />
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/openapi-generator/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639" />
    </a>
  </p>
</div>

**Automatically generate professional API documentation and client SDKs** for your ApostropheCMS project. Discover all routes—including Pro module endpoints—and create comprehensive OpenAPI 3.1 specs with zero configuration.

---

## Table of Contents

- [Why ApostropheCMS OpenAPI Generator?](#why-apostrophecms-openapi-generator)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Commands & Usage](#commands--usage)
- [Client SDK Generation](#client-sdk-generation)
- [Authentication](#authentication)
- [Configuration](#configuration)
- [Development Workflow](#development-workflow)
- [Contributing](#contributing)
- [Community & Support](#community--support)

---

## Why ApostropheCMS OpenAPI Generator?

- **🎯 Your Complete API**: Documents YOUR content types, custom pieces, and routes—not just core CMS
- **🚀 Zero Configuration**: Works instantly with any ApostropheCMS 4+ project
- **🔍 Total Discovery**: Automatically finds all routes, schemas, and Pro module endpoints
- **📱 Production-Ready SDKs**: Generate enterprise-grade clients in TypeScript, Python, PHP, and 20+ other languages
- **⚡ Live Documentation**: Interactive testing environment for your specific API endpoints
- **🛠️ DevOps Ready**: Built for modern development workflows and CI/CD pipelines
- **🔧 Extensible**: Custom field mappers and route filtering for project-specific needs

## Requirements

- ApostropheCMS 4.0 or higher
- Node.js 22+
- For SDK generation:
  - **Java 8+** (required for npx or global usage)
  - **Optional:** global installation of `@openapitools/openapi-generator-cli` for faster repeat runs (uses `npx` by default)
  - **Optional:** Docker (if you prefer not to install Java). The generator will use the official `openapitools/openapi-generator-cli` image, which is pulled automatically the first time you run it.

## Installation

```bash
npm install @apostrophecms/openapi-generator
```

## Quick Start

1. **Add to your ApostropheCMS project:**
Configure the module in your `app.js` file:
```javascript
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    '@apostrophecms/openapi-generator': {}
  }
});
```

2. **Generate your OpenAPI spec:**

```bash
node app openapi-generator:generate
```

3. **View interactive documentation:**

```bash
node app openapi-generator:docs --open
```

4. **Generate a client SDK:**

```bash
# Generate TypeScript client
node app openapi-generator:generateSDK typescript
```

5. **Use your generated SDK:**

```bash
# Copy the generated client to your frontend/application project
cp -r generated/typescript/* ../my-frontend-app/src/api/

# Install dependencies and build (varies by language)
cd ../my-frontend-app && npm install && npm run build
```

## How It Works

The generator uses a three-step process:

1. **Route Discovery**: Scans ApostropheCMS's route registry to find all registered endpoints
2. **Schema Discovery**: Examines module schemas to understand your content types
3. **Intelligent Merging**: Combines discoveries with a comprehensive base specification

### What Gets Discovered

**Routes:**
- All core ApostropheCMS API endpoints
- ApostropheCMS Pro module endpoints
- Your custom piece type endpoints
- Custom routes added via ApostropheCMS route methods (e.g. `restApiRoutes(self)`)

**Schemas:**
- Built-in piece types (User, Image, File, etc.)
- Your custom piece types
- Extended modules with additional fields
- Widget schemas and field definitions

### Base Specification

The generator includes a comprehensive base specification with:
- Core API documentation
- Complete field type definitions for all ApostropheCMS fields
- Standard error responses and authentication schemes
- Security configurations for all endpoints
- Organized tag groups and parameter definitions

Your discovered content extends this base rather than replacing it.

### Output Structure

Generated specs include:

- **Complete route coverage**: Every endpoint in your project
- **Semantic operation IDs**: `listArticles`, `getUser`, `createImage`
- **Logical grouping**: Operations grouped by resource type
- **Rich schemas**: Full property definitions with validation
- **Standard responses**: Consistent error handling and success responses

## Commands & Usage

| Command | Description | Key Options |
|------------|-------------|-------------|
| `generate` | Generate OpenAPI specification | `--output=FILE`, `--dry-run`, `--routes-only`, `--schemas-only`, `--verbose` |
| `validate` | Validate OpenAPI specification | `--spec=FILE` |
| `docs` | Serve interactive documentation | `--open` |
| `generateSDK` | Generate client SDKs | `<language>`, `--output=DIR`, `--props=PROPS`, `--config=FILE` |

### Basic Generation

```bash
# Generate complete OpenAPI spec (outputs to openapi/apostrophecms-openapi.yaml)
node app openapi-generator:generate

# Custom output file
node app openapi-generator:generate --output=my-api.yaml
```

### Development & Testing

```bash
# See what routes would be discovered (no file output)
node app openapi-generator:generate --routes-only

# See what schemas would be discovered (no file output)
node app openapi-generator:generate --schemas-only

# Preview everything without writing files
node app openapi-generator:generate --dry-run

# Get detailed error information
node app openapi-generator:generate --verbose
```

### File Validation
Once you have an OpenAPI file on disk, you can use the `validate` task to confirm that it is still a **valid OpenAPI 3.1 specification**.

This command does **not** regenerate or modify your spec — it only runs validation against an existing file, which is useful when:

- You manually edited the generated spec (e.g., added custom descriptions or examples).
- You renamed/moved the spec file and want to be sure it’s still valid before publishing it to Postman, Redoc, or other tooling.
- You want a quick check in CI to fail the build if someone introduces an invalid change.

```bash
# Validate existing specification using either the default
node app openapi-generator:validate
# Or custom output file name
node app openapi-generator:validate --spec=custom-spec.yaml
```

### Documentation

```bash
# Serve interactive documentation
node app openapi-generator:docs
node app openapi-generator:docs --open
```

## Client SDK Generation

Generate type-safe client libraries in multiple languages for easy API integration.

### Supported Languages

The generator supports 20+ languages, with these three built into the CLI for common use cases:

- **TypeScript**: Universal for modern web frontends and Node.js backends
- **Python**: Dominant in data science, automation, and content migration workflows—essential for ETL processes and AI-powered content applications
- **PHP**: The web's most widely-used server-side language, powering 77% of websites—critical for existing LAMP stack integrations and legacy system migrations

### SDK Requirements

The `generateSDK` task automatically uses **npx**, so in most cases you don't need to install anything extra.
All you need is **Java 8+** available on your system.

The generator tries multiple approaches in order of convenience:

1. **NPX (default)**
   - Runs `npx @openapitools/openapi-generator-cli` automatically
   - Downloads the generator each time you use it
   - Works out of the box with Java 8+ installed

2. **Global install (optional)** — *faster repeat runs*
   - Install once with:
     ```bash
     npm install -g @openapitools/openapi-generator-cli
     ```
   - Also requires Java 8+
   - Speeds up subsequent SDK generations since the generator is cached locally

3. **Docker (optional)** — *no Java required*
   - Uses the official `openapitools/openapi-generator-cli` Docker image
   - Great if you prefer not to install Java locally
   - Requires Docker installed and running

**Check your Java installation** (needed for npx or global):
```bash
java -version
```
If not installed, get OpenJDK 8+ from your package manager or [OpenJDK](https://openjdk.org).

### Quick SDK Generation

```bash
# TypeScript/JavaScript client with Axios
node app openapi-generator:generateSDK typescript

# Python client
node app openapi-generator:generateSDK python

# PHP client
node app openapi-generator:generateSDK php
```

### Advanced SDK Options

Use any [OpenAPI Generator](https://openapi-generator.tech/docs/generators) language:

```bash
# Java client with custom properties
node app openapi-generator:generateSDK java --props "groupId=com.example,artifactId=apostrophe-client"

# Go client with configuration file
node app openapi-generator:generateSDK go --config=./go-config.json

# Kotlin client
node app openapi-generator:generateSDK kotlin
```

### What's Included in Generated SDKs

Every generated SDK comes with comprehensive documentation and features:

**Rich Documentation:**
- **Complete API documentation** in the `docs/` folder
- **Comprehensive README** with examples for every endpoint
- **Language-appropriate type safety** (full TypeScript definitions, Python type hints, strongly-typed clients for Go/Rust/Java)
- **Authentication helpers** and error handling examples

**Client Features by Language:**

**TypeScript / JavaScript:**
- Modern `async/await` with Axios HTTP client
- Full TypeScript definitions with IntelliSense support
- Works in both Node.js and browser environments
- Tree-shakable imports for optimal bundle size

**Python:**
- Standard Python package with pip compatibility
- Type hints for better IDE support (where applicable)
- Perfect for data migration scripts and ETL processes
- Excellent for AI/ML applications working with your content

**PHP:**
- Composer-friendly package structure
- Basic type annotations and IDE autocomplete
- Great for WordPress → ApostropheCMS migration scripts
- Server-rendered applications and legacy system integration

### Using Your Generated SDK

1. **Copy to your project:**
```bash
# Copy TypeScript client
cp -r generated/typescript/* ../my-frontend-app/src/api/

# Copy Python client
cp -r generated/python/* ../my-python-app/apostrophe_client/

# Copy PHP client
cp -r generated/php/* ../my-php-app/src/ApostropheCMS/
```

2. **Install and build:**
```bash
# TypeScript
cd ../my-frontend-app && npm install && npm run build

# Python
cd ../my-python-app && pip install -r requirements.txt

# PHP
cd ../my-php-app && composer install
```

3. **Use in your application:**

**TypeScript/JavaScript Example:**
**TypeScript/JavaScript Example:**
```typescript
import 'dotenv/config';
import { Configuration, ArticlesApi, UsersApi, EventsApi } from './generated-client';

const config = new Configuration({
  basePath: process.env.APOSTROPHE_BASE_URL || 'http://localhost:3000/api/v1',
  apiKey: process.env.APOSTROPHE_API_KEY || 'your-api-key-here'
});

// Resource-scoped clients for your custom content types
const articles = new ArticlesApi(config);
const events = new EventsApi(config);
const users = new UsersApi(config);

async function run() {
  // --- Your Custom Articles ---
  // List articles with filtering
  const articleList = await articles.listArticles(1, 10);
  console.log('Articles:', articleList.data);

  // Create a new article
  const newArticle = await articles.createArticle({
    title: 'My New Article',
    body: 'Article content here...',
    tags: ['news', 'updates'],
    publishedAt: new Date().toISOString()
  });
  console.log('Created article:', newArticle.data);

  // --- Your Custom Events ---
  // Get upcoming events
  const upcomingEvents = await events.listEvents(1, 5);
  console.log('Upcoming events:', upcomingEvents.data);

  // --- Users ---
  // List users
  const userList = await users.userList();
  console.log('Users:', userList.data);
}

try {
  await run();
} catch (err: any) {
  console.error(err?.response?.data ?? err.message);
}
```

**Python Example:**
```python
# Python
from apostrophecms_client import DefaultApi, Configuration

config = Configuration(host="https://your-apostrophe-site.com/api/v1")
api = DefaultApi(config)

articles = api.list_articles()
```

**PHP Example:**
```php
<?php
// PHP
use ApostropheCMS\DefaultApi;
use ApostropheCMS\Configuration;

$config = new Configuration();
$config->setHost('https://your-apostrophe-site.com/api/v1');
$api = new DefaultApi($config);

$articles = $api->listArticles();
```

## Authentication

The generated SDKs support all ApostropheCMS authentication methods:

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
For browser-based applications, you can use standard session cookies alongside the API:
```javascript
const config = new Configuration({
  basePath: 'http://localhost:3000/api/v1',
  withCredentials: true // Include session cookies
});
```

**Authentication Priority:**
- **API key** (query string): pass `apiKey` into `Configuration({ apiKey: '…' })`
- **Bearer token**: pass `accessToken` into `Configuration({ accessToken: '…' })`
- **Session/cookie**: enable `withCredentials` and run in an environment that includes the session cookie

### Security

All generated endpoints include appropriate security schemes:

```yaml
security:
  - ApiKeyAuth: []
  - BearerAuth: []
  - SessionAuth: []
  - {} # Allows unauthenticated access as fallback
```

This provides multiple authentication options while maintaining compatibility with the ApostropheCMS authentication systems.

## Configuration

The generator works without configuration, but you can customize its behavior:

```javascript
// In your module configuration
'@apostrophecms/openapi-generator': {
  options: {
    // Exclude specific routes
    openapiRoutes: {
      exclude: ['debug', 'internal-test', 'admin-only']
    },

    // Custom field type mappings
    openapiFieldMappers: {
      customColor: (field) => ({
        type: 'string',
        pattern: '^#(?:[0-9a-fA-F]{3}){1,2}$',
        description: field.help || 'Hex color value'
      }),

      geoLocation: (field) => ({
        type: 'object',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 }
        },
        required: ['lat', 'lng'],
        description: field.help || 'Geographic coordinates'
      })
    }
  }
}
```

### Route Exclusion

Use `openapiRoutes.exclude` to filter out individual routes or entire resources:

```javascript
openapiRoutes: {
  exclude: [
    'debug',               // Excludes any route containing this string
    'article/publish',     // Excludes specific route
    'internal'             // Excludes entire internal resource
  ]
}
```

**Filtering Logic:**
- **Partial matches**: `'debug'` excludes `/api/v1/user/debug-stats`
- **Specific routes**: `'article/publish'` excludes only `POST /api/v1/article/{id}/publish`
- **Entire resources**: `'internal'` excludes all internal endpoints

### Custom Field Mappers

Define how custom field types should appear in the OpenAPI schema:

```javascript
openapiFieldMappers: {
  // Override built-in field types
  email: (field) => ({
    type: 'string',
    format: 'email',
    pattern: '^[^@]+@[^@]+\\.[^@]+$',
    description: field.help || 'Email address with enhanced validation'
  }),

  // Handle project-specific field types
  geoLocation: (field) => ({
    type: 'object',
    properties: {
      lat: { type: 'number' },
      lng: { type: 'number' }
    },
    description: field.help || 'Geographic coordinates'
  })
}
```

## Development Workflow

### 1. During Development
```bash
# Regenerate docs as you add custom fields/pieces
node app openapi-generator:generate
node app openapi-generator:docs --open  # Test your new endpoints
```

### 2. Frontend Integration
```bash
# Update your frontend client when schema changes
node app openapi-generator:generateSDK typescript
cp -r generated/typescript/* ../my-next-app/src/lib/api/
cd ../my-next-app && npm run build
```

### 3. CI/CD Integration
```bash
# Add to your deployment pipeline
node app openapi-generator:validate  # Ensure spec is valid
node app openapi-generator:generateSDK typescript --output=../frontend/src/api
```

### 4. API Testing & Validation
```bash
# Mock server for development
npm install -g @stoplight/prism-cli
prism mock openapi/apostrophecms-openapi.yaml

# Mock server runs at http://localhost:4010
```

## Contributing

We welcome contributions to improve the generator:

1. **Fork the repository** and create a feature branch
2. **Make your changes** and add tests
3. **Run tests** to ensure everything works
4. **Submit a pull request** with a clear description

Please ensure all changes:
- Follow existing code patterns
- Include appropriate tests
- Update documentation if needed
- Work with the latest ApostropheCMS version

## Community & Support

- **[Discord Community](https://discord.com/invite/HwntQpADJr)** - Get help from other developers
- **[GitHub Issues](https://github.com/apostrophecms/openapi-generator/issues)** - Report bugs or request features
- **[Documentation](https://docs.apostrophecms.org/)** - Comprehensive guides and API reference
- **[Professional Support](https://apostrophecms.com/contact-us)** - Enterprise support and consulting

---

## 💎 Ready for Enterprise Features?

**Need advanced API capabilities for your development workflow?** This free OpenAPI generator works great with [**ApostropheCMS Pro**](https://apostrophecms.com/extensions?autocomplete=&license=pro) extensions to document enterprise-grade endpoints:

### 🚀 **ApostropheCMS Pro Features**
- [**🤖 SEO Assistant**](https://apostrophecms.com/extensions/seo-assistant) - AI-powered content optimization with dedicated API endpoints
- [**📄 Document Versions**](https://apostrophecms.com/extensions/document-version) - Complete revision management and rollback APIs
- [**🔐 Advanced Permissions**](https://apostrophecms.com/extensions/advanced-permission) - Granular access control with user group management
- [**🌍 Automatic Translation**](https://apostrophecms.com/extensions/automatic-translation) - Instant multilingual content generation with AI-powered translations

**Create an account** on Apostrophe Workspaces and upgrade to [**ApostropheCMS Pro**](https://app.apostrophecms.com/login) or **[contact our team](https://apostrophecms.com/contact-us)** to learn more about ApostropheCMS Pro licensing and unlock enterprise-grade API endpoints that will enhance your documentation and development capabilities.

---

<div>
  <p>Made with ❤️ by the <a href="https://apostrophecms.com">ApostropheCMS</a> team. <strong>Found this useful? <a href="https://github.com/apostrophecms/openapi-generator">Give us a star on GitHub!</a> ⭐</strong>
  </p>
</div>
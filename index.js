import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { RouteDiscovery } from './lib/route-discovery.js';
import { SchemaDiscovery } from './lib/schema-discovery.js';
import { SpecMerger } from './lib/spec-merger.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  options: {
    alias: 'openapi-generator'
  },

  /**
   * Register CLI tasks.
   * - openapi-generator:generate  → discover, merge, and (optionally) write YAML
   * - openapi-generator:validate  → validate an existing spec
   */
  tasks(self) {
    return {
      generate: {
        usage: `Usage: node app openapi-generator:generate [options]

Generate OpenAPI specification for this ApostropheCMS project

Options:
  --output=FILE     Output file path (default: apostrophecms-openapi.yaml)
  --dry-run         Show what would be generated without writing files
  --routes-only     Only run route discovery (dry-run mode)
  --schemas-only    Only run schema discovery (dry-run mode)
  --verbose         Print full stack traces on errors
`,

        /**
         * Discover routes/schemas, merge with base spec, and write YAML (unless dry-run).
         * Prints summaries in dry-run modes.
         *
         * @param {object} argv - CLI flags from Apostrophe task runner.
         *   Recognized flags: output, dry-run, routes-only, schemas-only, verbose
         * @returns {Promise<void>}
         */
        async task(argv) {
          const output = argv && argv.output ? String(argv.output) : './openapi/apostrophecms-openapi.yaml';
          const dryRun = !!(argv && argv['dry-run']);
          const routesOnly = !!(argv && argv['routes-only']);
          const schemasOnly = !!(argv && argv['schemas-only']);
          const verbose = !!(argv && argv.verbose);

          try {
            console.log('🚀 Starting OpenAPI generation...\n');

            let routes = [];
            if (!schemasOnly) {
              console.log('📍 Step 1: Discovering routes...');
              const routeDiscovery = new RouteDiscovery(self.apos);
              routes = await routeDiscovery.discoverRoutes();
              console.log(`   Found ${routes.length} routes`);

              if (dryRun || routesOnly) {
                console.log('\n📋 Route Discovery Results:');
                self.printRouteSummary(routes);
              }

              if (routesOnly) {
                console.log('\n✅ Route discovery complete (routes-only mode)');
                return;
              }
            }

            let schemas = {};
            if (!routesOnly) {
              console.log('\n🔍 Step 2: Discovering schemas...');
              const schemaDiscovery = new SchemaDiscovery(self.apos);
              schemas = await schemaDiscovery.discoverSchemas();
              console.log(`   Found ${Object.keys(schemas || {}).length} schemas`);

              if (dryRun || schemasOnly) {
                console.log('\n📋 Schema Discovery Results:');
                self.printSchemaSummary(schemas);
              }

              if (schemasOnly) {
                console.log('\n✅ Schema discovery complete (schemas-only mode)');
                return;
              }
            }

            if (dryRun) {
              console.log('\n✅ Dry run complete - no files written');
              return;
            }

            // 3) Merge with base spec and write
            console.log('\n🔧 Step 3: Merging with base specification...');
            const specMerger = new SpecMerger();

            const baseSpecPath = new URL('./templates/base-spec.yaml', import.meta.url);

            const finalSpec = await specMerger.mergeSpec(baseSpecPath, routes, schemas);

            const outputPath = path.resolve(process.cwd(), output);
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            const yamlOutput = yaml.dump(finalSpec, { lineWidth: 120, noRefs: false });
            await fs.writeFile(outputPath, yamlOutput, 'utf8');

            const pathCount = finalSpec && finalSpec.paths ? Object.keys(finalSpec.paths).length : 0;
            const schemaCount = finalSpec && finalSpec.components && finalSpec.components.schemas
              ? Object.keys(finalSpec.components.schemas).length
              : 0;

            console.log(`\n✅ OpenAPI specification generated: ${outputPath}`);
            console.log(`📊 Final spec contains:`);
            console.log(`   • ${pathCount} paths`);
            console.log(`   • ${schemaCount} schemas`);
          } catch (error) {
            console.error('\n❌ Error generating OpenAPI spec:', error && error.message ? error.message : String(error));
            if (verbose && error && error.stack) {
              console.error(error.stack);
            }
            process.exit(1);
          }
        }
      },

      validate: {
        usage: `Validate an existing OpenAPI specification

Options:
  --spec=FILE       Path to spec file (YAML or JSON). Default: apostrophecms-openapi.yaml
`,

        /**
         * Validate an existing OpenAPI document at the provided path.
         * Exits with non-zero code on validation errors.
         *
         * @param {object} argv
         * @returns {Promise<void>}
         */
        async task(argv) {
          const specPath = argv && argv.spec ? String(argv.spec) : './openapi/apostrophecms-openapi.yaml';
          try {
            const spec = await self.loadSpecFile(specPath);
            const validation = await self.validateSpec(spec);

            if (validation && validation.valid) {
              console.log('✅ OpenAPI specification is valid');
            } else {
              const errs = (validation && validation.errors) || [];
              console.log('❌ OpenAPI specification has errors:');
              errs.forEach(e => {
                const msg = e && e.message ? e.message : 'Unknown error';
                const at = e && e.instancePath ? ` (${e.instancePath})` : '';
                console.log(`  - ${msg}${at}`);
              });
              process.exit(1);
            }
          } catch (error) {
            console.error('❌ Failed to validate specification:', error && error.message ? error.message : String(error));
            process.exit(1);
          }
        }
      },

      docs: {
        usage: `Usage: node app openapi-generator:docs [options]

Serve OpenAPI specification documentation in a web browser

Options:
  --open            Automatically open the documentation in your default browser
`,

        async task(argv) {
          const scriptPath = path.join(__dirname, '/scripts/serve-docs.js');

          const args = [scriptPath, '--spec', path.join(self.apos.rootDir, 'openapi/apostrophecms-openapi.yaml')];
          if (argv.open) {
            args.push('--open');
          }

          const child = spawn('node', args, {
            stdio: 'inherit',
            cwd: self.apos.rootDir
          });

          return new Promise((resolve, reject) => {
            child.on('close', (code) => {
              if (code !== 0) {
                reject(new Error(`Process exited with code ${code}`));
              } else {
                resolve();
              }
            });
          });
        }
      },

      generateSDK: {
        usage: `Usage: node app openapi-generator:generateSDK <language> [options]

Generate client SDK from OpenAPI specification

Arguments:
  <language>        Language/generator to use. Preset options: typescript, python, php
                    Or any openapi-generator-cli generator name for custom generation

Options:
  --output=DIR      Output directory (default: ./generated/<language>)
  --props=PROPS     Additional properties as comma-separated key=value pairs
  --config=FILE     Use configuration file for generator settings
  --global-property=PROPS    Global properties for the generator
  --import-mappings=MAP      Import mappings for the generator
  --type-mappings=MAP        Type mappings for the generator

Examples:
  node app openapi-generator:generateSDK typescript
  node app openapi-generator:generateSDK python --output ./my-python-client
  node app openapi-generator:generateSDK java --props "groupId=com.example,artifactId=apostrophe-client"
  node app openapi-generator:generateSDK kotlin --config ./kotlin-config.json
`,

        async task(argv) {
          const language = argv._[1];
          const outputDir = argv.output || `./generated/${language}`;
          const specPath = path.join(self.apos.rootDir, 'openapi/apostrophecms-openapi.yaml');

          if (!language) {
            throw new Error('Please specify a language/generator');
          }

          // Check if OpenAPI spec file exists
          try {
            await fs.access(specPath);
          } catch (error) {
            throw new Error(`OpenAPI spec file not found at ${specPath}. Please run 'node app openapi-generator:generate' first.`);
          }

          // Predefined configurations for common languages
          const presets = {
            typescript: {
              generator: 'typescript-axios',
              additionalProperties: 'npmName=apostrophecms-client,supportsES6=true'
            },
            python: {
              generator: 'python',
              additionalProperties: 'packageName=apostrophecms_client'
            },
            php: {
              generator: 'php',
              additionalProperties: 'packageName=ApostropheCMS,invokerPackage=ApostropheCMS,composerVendorName=apostrophecms,composerPackageName=api-client'
            }
          };

          let generator, additionalProperties;

          if (presets[language]) {
            // Use preset configuration
            generator = presets[language].generator;
            additionalProperties = presets[language].additionalProperties;
            console.log(`Using preset configuration for ${language}`);
          } else {
            // Treat language as the generator name directly
            generator = language;
            additionalProperties = argv['additional-properties'] || argv.props || '';
            console.log(`Using custom generator: ${generator}`);
          }
          const finalOutputDir = path.resolve(self.apos.rootDir, outputDir.replace(/^\.\//, ''));

          const args = [
            'generate',
            '-i', specPath,
            '-g', generator,
            '-o', finalOutputDir
          ];

          if (additionalProperties) {
            args.push('--additional-properties', additionalProperties);
          }

          // Allow other openapi-generator-cli options to be passed through
          if (argv['global-property']) {
            args.push('--global-property', argv['global-property']);
          }

          if (argv['import-mappings']) {
            args.push('--import-mappings', argv['import-mappings']);
          }

          if (argv['type-mappings']) {
            args.push('--type-mappings', argv['type-mappings']);
          }

          if (argv.config) {
            args.push('-c', argv.config);
          }

          console.log(`Generating SDK with generator "${generator}" to ${outputDir}...`);

          // Create output directory if it doesn't exist
          const resolvedOutputDir = path.resolve(outputDir);
          await fs.mkdir(resolvedOutputDir, { recursive: true });
          console.log(`Created output directory: ${resolvedOutputDir}`);

          // Try multiple approaches to run the generator
          const approaches = [
            // Approach 1: Use globally installed CLI
            () => {
              const child = spawn('openapi-generator-cli', args, {
                stdio: 'inherit',
                cwd: self.apos.rootDir
              });
              return child;
            },
            // Approach 2: Use npx with explicit package name
            () => {
              const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
              const child = spawn(npxBin, ['--yes', '@openapitools/openapi-generator-cli', ...args], {
                stdio: 'inherit',
                cwd: self.apos.rootDir
              });
              return child;
            },
            // Approach 3: Use Docker (if available)
            () => {
              const dockerArgs = [
                'run', '--rm',
                '-v', `${self.apos.rootDir}:/local`,
                'openapitools/openapi-generator-cli',
                ...args.map(arg => arg.replace(self.apos.rootDir, '/local'))
              ];
              const child = spawn('docker', dockerArgs, {
                stdio: 'inherit',
                cwd: self.apos.rootDir
              });
              return child;
            }
          ];

          for (let i = 0; i < approaches.length; i++) {
            try {
              const child = approaches[i]();

              const result = await new Promise((resolve, reject) => {
                child.on('close', (code) => {
                  resolve(code);
                });

                child.on('error', (error) => {
                  reject(error);
                });
              });

              if (result === 0) {
                console.log(`✅ SDK generated successfully in ${outputDir}`);
                return;
              }
            } catch (error) {
              console.log(`Approach ${i + 1} failed: ${error.message}`);
              if (i === approaches.length - 1) {
                // All approaches failed
                throw new Error(`Failed to generate SDK. Please ensure one of the following is available:
1. Install globally: npm install -g @openapitools/openapi-generator-cli
2. Ensure npx is working properly
3. Install Docker and use the openapitools/openapi-generator-cli image

Error details: ${error.message}`);
              }
            }
          }
        }
      }
    }
  },

  /**
   * Helper methods used by tasks.
   */
  methods(self) {
    return {
      /**
       * Print a grouped summary of discovered routes.
       * Groups by first path segment and honors base spec order
       *
       * @param {Array<{ method: string, path: string, module?: string }>} routes
       */
      printRouteSummary(routes) {
        if (!Array.isArray(routes) || routes.length === 0) {
          console.log('   (no routes)');
          return;
        }

        const groups = new Map();
        for (const route of routes) {
          const key = (route && route.path ? route.path : '/')
            .replace(/^\/+/, '')
            .split('/')[0] || '(root)';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(route);
        }

        for (const [resource, list] of groups.entries()) {
          console.log(`\n   ${resource}:`);
          list.forEach(route => {
            const method = (route && route.method ? route.method : '').toUpperCase().padEnd(6);
            const path = route && route.path ? route.path : '';
            console.log(`     ${method} ${path}`);
          });
        }
      },

      /**
       * Print a compact summary of discovered schemas and their field counts.
       *
       * @param {Object<string, { properties?: Object<string, any> }>} schemas
       */
      printSchemaSummary(schemas) {
        if (!schemas || typeof schemas !== 'object') {
          console.log('   (no schemas)');
          return;
        }
        const entries = Object.entries(schemas);
        if (entries.length === 0) {
          console.log('   (no schemas)');
          return;
        }
        for (const [name, schema] of entries) {
          const fields = schema && schema.properties ? Object.keys(schema.properties).length : 0;
          console.log(`   📋 ${name} (${fields} fields)`);
        }
      },

      /**
       * Load an OpenAPI spec from disk (YAML or JSON) and parse it.
       *
       * @param {string} filePath
       * @returns {Promise<any>}
       */
      async loadSpecFile(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        return filePath.endsWith('.json') ? JSON.parse(content) : yaml.load(content);
      },

      /**
       * Validate an OpenAPI spec object using @apidevtools/swagger-parser.
       *
       * @param {any} spec
       * @returns {Promise<{ valid: boolean, errors: Array<{ message: string, instancePath: string }> }>}
       */
      async validateSpec(spec) {
        const { default: SwaggerParser } = await import('@apidevtools/swagger-parser');
        try {
          // Deep clone to avoid mutations by the validator.
          await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
          return { valid: true, errors: [] };
        } catch (e) {
          const details = (e && e.details) ? e.details : [e];
          const errors = details.map(d => ({
            message: (d && d.message) ? d.message : (e && e.message) ? e.message : 'Validation error',
            instancePath: d && d.path ? '/' + d.path.join('/') : ''
          }));
          return { valid: false, errors };
        }
      }
    };
  }
};

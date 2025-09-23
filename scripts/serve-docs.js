import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import open from 'open';
import swaggerUIDist from 'swagger-ui-dist';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

// CLI flags
const port = Number(getArgValue('--port')) || Number(process.env.PORT) || 3001;
const specArg = getArgValue('--spec');
const titleArg = getArgValue('--title') || 'ApostropheCMS API';
const shouldOpen = process.argv.includes('--open');

// Resolve spec path: default to project ./openapi/apostrophecms-openapi.yaml
const resolvedSpecPath = specArg
  ? path.resolve(process.cwd(), specArg)
  : path.resolve(process.cwd(), 'openapi/apostrophecms-openapi.yaml');

const app = express();

// Serve swagger-ui assets
const swaggerUiAssetPath = swaggerUIDist.getAbsoluteFSPath();
app.use('/swagger-ui', express.static(swaggerUiAssetPath));

// Optional: serve custom CSS from a local ./styles folder inside this package
const localStylesDir = path.join(__dirname, '../styles');
console.log('style!!!!!!!!!!!!!', localStylesDir)
if (fs.existsSync(localStylesDir)) {
  app.use('/styles', express.static(localStylesDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
      res.setHeader('Cache-Control', 'no-store');
    }
  }));
}

// Serve the OpenAPI spec (with a friendly error if missing)
app.get('/openapi.yaml', (req, res) => {
  fs.access(resolvedSpecPath, fs.constants.R_OK, (err) => {
    if (err) {
      res
        .status(404)
        .type('text')
        .send(
          `OpenAPI spec not found at:\n${resolvedSpecPath}\n\n` +
          `Pass a custom path with: --spec ./path/to/spec.yaml`
        );
      return;
    }
    res.sendFile(resolvedSpecPath);
  });
});

// HTML shell
app.get('/', (_req, res) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titleArg)} • Swagger UI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" type="text/css" href="/swagger-ui/swagger-ui.css" />
  ${fs.existsSync(path.join(localStylesDir, 'theme.css')) ? '<link rel="stylesheet" href="/styles/theme.css" />' : ''}
  <style>
    #swagger-ui .topbar { display: none; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script src="/swagger-ui/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      const ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        persistAuthorization: true
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

// Start server
app.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`📚 ApostropheCMS API Documentation available at: ${url}`);
  console.log(`📝 Serving spec from: ${resolvedSpecPath}`);
  if (shouldOpen) open(url);
});

// --- utils ---
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

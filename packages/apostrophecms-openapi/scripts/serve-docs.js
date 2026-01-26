const express = require('express');
const path = require('path');
const fs = require('fs');
const open = require('open');

const app = express();
const port = 3001;

// Serve swagger-ui-dist files
const swaggerUiAssetPath = require('swagger-ui-dist').getAbsoluteFSPath();
app.use('/swagger-ui', express.static(swaggerUiAssetPath));

// Serve custom CSS
app.use('/styles', express.static(path.join(__dirname, '../styles'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Serve the OpenAPI spec
app.get('/openapi.yaml', (req, res) => {
  res.sendFile(path.join(__dirname, '../apostrophecms-openapi.yaml'));
});

// Serve a custom HTML page
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ApostropheCMS API Documentation</title>
  <link rel="stylesheet" type="text/css" href="/swagger-ui/swagger-ui.css" />
  <link rel="stylesheet" type="text/css" href="/styles/swagger.css" />
  <style>
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script src="/swagger-ui/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.yaml',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset
      ],
      layout: "BaseLayout",
      deepLinking: true,
      showExtensions: true,
      showCommonExtensions: true
    });
  </script>
</body>
</html>`;
  res.send(html);
});

app.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`📚 ApostropheCMS API Documentation available at: ${url}`);
  console.log(`📝 Edit apostrophecms-openapi.yaml and refresh to see changes`);

  // Open browser if --open flag is passed
  if (process.argv.includes('--open')) {
    open(url);
  }
});
#!/usr/bin/env node
// Post-process script to group changelog entries by type
// Run this after: npx changeset version
// Usage: node scripts/format-changelog.js

const fs = require('fs');
const path = require('path');

function formatChangelog(changelogPath) {
  const content = fs.readFileSync(changelogPath, 'utf8');
  const lines = content.split('\n');
  const formatted = [];

  let currentSection = [];
  let inVersion = false;
  const sections = {
    Breaking: [],
    Adds: [],
    Changes: [],
    Fixes: [],
    Dependencies: []
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect version header (e.g., "## 4.24.1 (2025-12-04)")
    if (line.match(/^##\s+\d+\.\d+\.\d+/)) {
      // If we were in a version, output the grouped sections
      if (inVersion && Object.values(sections).some(arr => arr.length > 0)) {
        formatted.push(...currentSection);
        formatted.push('');

        // Add sections in order
        [ 'Breaking', 'Adds', 'Changes', 'Fixes', 'Dependencies' ].forEach(type => {
          if (sections[type].length > 0) {
            formatted.push(`### ${type}`);
            sections[type].forEach(item => formatted.push(item));
            formatted.push('');
          }
        });

        // Clear sections for next version
        Object.keys(sections).forEach(key => {
          sections[key] = [];
        });
      }

      // Start new version
      currentSection = [ line ];
      inVersion = true;
      continue;
    }

    // If we're in a version section
    if (inVersion) {
      // Check for TYPE marker
      const typeMatch = line.match(/<!-- TYPE:(\w+) -->(.*)/);
      if (typeMatch) {
        const [ , type, content ] = typeMatch;
        if (sections[type]) {
          sections[type].push(content);
        }
        continue;
      }

      // If it's a regular changelog line (starts with -)
      if (line.trim().startsWith('-')) {
        // Default to Adds if no marker found
        sections.Adds.push(line);
        continue;
      }

      // Stop at next heading or empty changelog section
      if (line.match(/^##/) && !line.match(/^##\s+\d+\.\d+\.\d+/)) {
        inVersion = false;
      }
    }

    // If not in a version section, keep the line as-is
    if (!inVersion) {
      formatted.push(line);
    }
  }

  // Output final version if exists
  if (inVersion && Object.values(sections).some(arr => arr.length > 0)) {
    formatted.push(...currentSection);
    formatted.push('');

    [ 'Breaking', 'Adds', 'Changes', 'Fixes', 'Dependencies' ].forEach(type => {
      if (sections[type].length > 0) {
        formatted.push(`### ${type}`);
        sections[type].forEach(item => formatted.push(item));
        formatted.push('');
      }
    });
  }

  return formatted.join('\n').trim() + '\n';
}

// Find all CHANGELOG.md files
function findChangelogs(dir = process.cwd()) {
  const changelogs = [];

  // Check root
  const rootChangelog = path.join(dir, 'CHANGELOG.md');
  if (fs.existsSync(rootChangelog)) {
    changelogs.push(rootChangelog);
  }

  // Check packages directory
  const packagesDir = path.join(dir, 'packages');
  if (fs.existsSync(packagesDir)) {
    const packages = fs.readdirSync(packagesDir);
    packages.forEach(pkg => {
      const pkgChangelog = path.join(packagesDir, pkg, 'CHANGELOG.md');
      if (fs.existsSync(pkgChangelog)) {
        changelogs.push(pkgChangelog);
      }
    });
  }

  return changelogs;
}

// Main execution
const changelogs = findChangelogs();

if (changelogs.length === 0) {
  console.log('No CHANGELOG.md files found');
  process.exit(0);
}

console.log(`Formatting ${changelogs.length} changelog(s)...`);

changelogs.forEach(changelogPath => {
  try {
    const formatted = formatChangelog(changelogPath);
    fs.writeFileSync(changelogPath, formatted, 'utf8');
    console.log(`✓ Formatted: ${changelogPath}`);
  } catch (error) {
    console.error(`✗ Error formatting ${changelogPath}:`, error.message);
  }
});

console.log('Done!');

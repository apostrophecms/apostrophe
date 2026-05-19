// Minimal dotenv writer.

import {
  existsSync, readFileSync, writeFileSync
} from 'node:fs';

/**
 * Quote a value only when dotenv would otherwise mis-parse it (whitespace,
 * `#`, quotes, backslash). Hex secrets need no quoting; a DB URI with special
 * characters does.
 */
function formatValue(value) {
  const s = String(value);
  if (s === '' || /[\s#"'\\]/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

/**
 * Write `content` to `path` only if no file is there yet.
 */
export function writeIfAbsent(path, content) {
  if (existsSync(path)) {
    return false;
  }
  writeFileSync(path, content);
  return true;
}

/**
 * Upsert `KEY=value` lines. An existing key (line starting `KEY=`, possibly
 * with an empty value from the template) is replaced in place; a new key is
 * appended. File ends with a newline.
 * @param {string} envPath
 * @param {Record<string,string>} vars
 */
export function upsertEnv(envPath, vars) {
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  for (const [ key, value ] of Object.entries(vars)) {
    const line = `${key}=${formatValue(value)}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      if (content.length && !content.endsWith('\n')) {
        content += '\n';
      }
      content += `${line}\n`;
    }
  }
  if (content.length && !content.endsWith('\n')) {
    content += '\n';
  }
  writeFileSync(envPath, content);
}

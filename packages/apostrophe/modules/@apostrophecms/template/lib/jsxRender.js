// JSX render orchestration. Mixed into the `@apostrophecms/template`
// module by `index.js`, this file implements:
//
// * Template path resolution that walks the same module chain as Nunjucks
//   but knows about `.jsx` and prefers it when present alongside `.html`.
// * `renderJsxTemplate(req, resolved, data, module)` which loads the
//   compiled JSX module, invokes its default-exported function with
//   `(data, helpers)`, and flattens the resulting node tree into HTML.
// * The `Area`, `Component`, `Template`, `Extend`, and `Widget` runtime
//   helpers exposed to JSX templates as the second argument to their
//   default function.
// * The cross-engine bridge: when a JSX template invokes `Template`/
//   `Extend` against a Nunjucks `.html` layout, the helper synthesizes a
//   Nunjucks string that extends the target and turns each named prop
//   into a `{% block ... %}` override.

const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const jsxLoader = require('./jsxLoader.js');
const {
  Raw, flatten, registerSafeClass
} = require('./jsxRuntime.js');

const TEMPLATE_EXTENSIONS = [ 'jsx', 'njk', 'html' ];
const NUNJUCKS_EXTENSIONS = new Set([ 'njk', 'html' ]);

module.exports = function(self) {
  return {
    // Install the global JSX `require` hook and teach the runtime about
    // Nunjucks `SafeString` instances so they pass through unescaped.
    initJsx() {
      jsxLoader.install();
      registerSafeClass(self.nunjucks.runtime.SafeString);
    },

    // Walk a module's view-folder chain and find the first file matching
    // `name` with one of the supported extensions. JSX wins over Nunjucks
    // when both exist in the same directory, but the chain ordering still
    // takes precedence (a child module's `.html` still overrides a parent
    // module's `.jsx` if it appears earlier in the chain).
    //
    // `name` may be `'localname'` (resolved against the supplied
    // `module`'s chain) or `'modulename:localname'` (resolved against the
    // named module's chain). An explicit extension is honored verbatim.
    //
    // Returns `{ kind: 'jsx' | 'nunjucks', path, ext, moduleName,
    // baseName, ext, requestedName }` or `null` when nothing was found.
    resolveTemplate(module, name) {
      let moduleName = module.__meta.name;
      let filename = name;
      const colonAt = name.indexOf(':');
      if (colonAt !== -1) {
        moduleName = name.substring(0, colonAt);
        filename = name.substring(colonAt + 1);
      }
      const targetModule = self.apos.modules[moduleName];
      if (!targetModule) {
        return null;
      }
      const dirs = self.getViewFolders(targetModule);
      const m = filename.match(/^(.*)\.([^/.]+)$/);
      let baseName = filename;
      let requestedExt = null;
      if (m) {
        baseName = m[1];
        requestedExt = m[2];
      }
      // For requests without an extension, or for the well-known template
      // extensions, allow falling back to any of them. For an unknown
      // extension (e.g. `.svg`) preserve current Nunjucks-loader behavior:
      // try only the literal name.
      const exts = (!requestedExt || TEMPLATE_EXTENSIONS.includes(requestedExt))
        ? TEMPLATE_EXTENSIONS
        : [ requestedExt ];

      for (const dir of dirs) {
        for (const ext of exts) {
          const fullpath = path.join(dir, `${baseName}.${ext}`);
          if (fs.existsSync(fullpath)) {
            return {
              kind: ext === 'jsx' ? 'jsx' : 'nunjucks',
              path: fullpath,
              ext,
              moduleName,
              baseName,
              relativeName: `${baseName}.${ext}`,
              requestedName: name
            };
          }
        }
      }
      return null;
    },

    // Render the JSX module at `resolved.path` against `data`. Loads the
    // compiled module via Node's require (the `.jsx` extension hook
    // installed by `jsxLoader` does the Babel transform on first load),
    // calls its default function, and flattens the returned node tree.
    async renderJsxTemplate(req, resolved, data, module) {
      let mod;
      try {
        mod = require(resolved.path);
      } catch (e) {
        throw decorateJsxError(e, resolved.path);
      }
      const fn = (mod && mod.default) || mod;
      if (typeof fn !== 'function') {
        throw new Error(
          `JSX template ${resolved.path} must export a default function. ` +
          `Got ${typeof fn}.`
        );
      }
      const helpers = self.buildJsxHelpers(req, module, data);
      let result;
      try {
        result = await fn(data, helpers);
      } catch (e) {
        throw decorateJsxError(e, resolved.path);
      }
      try {
        return await flatten(result);
      } catch (e) {
        throw decorateJsxError(e, resolved.path);
      }
    },

    // Build the `{ apos, helpers, Area, Component, Extend, Template,
    // Widget, ... }` object passed as the second argument to every JSX
    // template. The closure captures `req`, `module` (the module whose
    // template is currently being rendered, used to resolve `Template`
    // names without a `module:` prefix), and `ambientData` (the merged
    // render data for the current invocation, threaded through
    // `Template`/`Extend` to mirror Nunjucks' `extends` semantics).
    buildJsxHelpers(req, module, ambientData) {
      const helpers = {
        apos: self.templateApos,
        // `helpers` is an alias for `apos` so JSX authors can name the
        // destructured variable whichever feels natural; both reach the
        // same wrapped helper functions exposed to Nunjucks.
        helpers: self.templateApos,
        // Localization helper, matching the Nunjucks `__t` global.
        __t: req.t && req.t.bind(req),

        Area: (props) => self.jsxArea(req, props),
        Component: (props) => self.jsxComponent(req, props),
        Widget: (props) => self.jsxWidget(req, props),
        Template: (props) => self.jsxInvoke(req, module, props, {
          mode: 'include',
          ambientData
        }),
        Extend: (props) => self.jsxInvoke(req, module, props, {
          mode: 'extend',
          ambientData
        })
      };
      return helpers;
    },

    // Implementation of the `<Area doc={..} name=".." with={..} />` helper.
    // Mirrors the Nunjucks `{% area %}` custom tag closely so behavior
    // (including stub-area persistence) is identical.
    jsxArea(req, props) {
      const {
        doc, name, with: ctx
      } = props || {};
      return (async () => {
        if (!doc || typeof doc !== 'object') {
          throw new Error(
            'Area: the `doc` prop must be an existing doc or widget object.'
          );
        }
        if (typeof name !== 'string') {
          throw new Error('Area: the `name` prop must be a string.');
        }
        if (!name.match(/^\w+$/)) {
          throw new Error(
            'Area: area names must consist only of letters, digits, and underscores.'
          );
        }
        let area = doc[name];
        if (!area) {
          // Same stub-into-db logic as the {% area %} tag, so that newly
          // added schema fields get a persistent `_id` on first render.
          area = {
            metaType: 'area',
            _id: self.apos.util.generateId(),
            items: []
          };
          doc[name] = area;
          const docId = doc._docId || ((doc.metaType === 'doc') ? doc._id : null);
          if (docId) {
            let mainDoc = await self.apos.doc.db.findOne({ _id: docId });
            if (!mainDoc) {
              throw self.apos.error('notfound');
            }
            let docDotPath;
            try {
              docDotPath = (doc._id === docId)
                ? ''
                : self.apos.util.findNestedObjectAndDotPathById(mainDoc, doc._id).dotPath;
            } catch (e) {
              throw self.apos.error('notfound');
            }
            const areaDotPath = docDotPath ? `${docDotPath}.${name}` : name;
            await self.apos.doc.db.updateOne({
              _id: docId,
              [areaDotPath]: { $eq: null }
            }, {
              $set: {
                [areaDotPath]: self.apos.util.clonePermanent(area)
              }
            });
            mainDoc = await self.apos.doc.db.findOne({ _id: docId });
            area._id = self.apos.util.get(mainDoc, areaDotPath)._id;
          }
        }
        const manager = self.apos.util.getManagerOf(doc);
        const field = manager && manager.schema.find(f => f.name === name);
        if (!field) {
          throw new Error(
            `Area: the doc of type ${doc.type} with the slug ${doc.slug} ` +
            `has no field named ${name}.`
          );
        }
        area._fieldId = field._id;
        area._docId = doc._docId || ((doc.metaType === 'doc') ? doc._id : null);
        area._edit = area._edit || doc._edit;
        self.apos.area.prepForRender(area, doc, name);
        const html = await self.apos.area.renderArea(req, area, ctx);
        return new Raw(html);
      })();
    },

    // Implementation of `<Component module="..." name="..." {...props} />`.
    // Looks up the named async component, awaits it, then renders the
    // component's matching template via the existing module render path.
    jsxComponent(req, props) {
      const {
        module: moduleName, name, children, ...rest
      } = props || {};
      return (async () => {
        if (typeof moduleName !== 'string' || typeof name !== 'string') {
          throw new Error(
            'Component: both `module` and `name` props must be strings.'
          );
        }
        const target = self.apos.modules[moduleName];
        if (!target) {
          throw new Error(
            `Component: module "${moduleName}" does not exist. ` +
            'It must be a real, instantiated module, not a base class.'
          );
        }
        if (!(target.components && target.components[name])) {
          throw new Error(
            `Component: ${moduleName}:${name} is not a registered async component.`
          );
        }
        // Components receive plain data: any JSX nodes passed as props
        // (including `children`) need to be flattened to HTML strings
        // first so the underlying Nunjucks/JSX component template can
        // safely render them.
        const inputProps = await self.flattenJsxProps({ ...rest, children });
        const result = await self.apos.util.recursionGuard(
          req,
          `component:${moduleName}:${name}`,
          async () => {
            const input = await target.components[name](req, inputProps);
            return target.render(req, name, input);
          }
        );
        if (result === undefined) {
          // Recursion guard kicked in.
          return new Raw('');
        }
        return new Raw(result);
      })();
    },

    // Implementation of `<Widget widget={..} options={..} with={..} />`.
    // Mirrors the Nunjucks `{% widget %}` tag, intended only for users
    // reimplementing `area.html` in JSX.
    jsxWidget(req, props) {
      const {
        widget, options, with: contextOptions
      } = props || {};
      return (async () => {
        if (!widget) {
          self.apos.util.warn('a null widget was encountered.');
          return new Raw('');
        }
        const opts = options || {};
        let ctxOpts = {};
        if (contextOptions && typeof contextOptions === 'object' && contextOptions[widget.type]) {
          ctxOpts = (typeof contextOptions[widget.type] === 'object')
            ? contextOptions[widget.type]
            : {};
        }
        const manager = self.apos.area.getWidgetManager(widget.type);
        if (!manager) {
          self.apos.area.warnMissingWidgetType(widget.type);
          return new Raw('');
        }
        const html = await manager.output(req, widget, opts, ctxOpts);
        return new Raw(html);
      })();
    },

    // Shared implementation of `Template` and `Extend`. The rules:
    //
    // * Strip `templateName`/`name` per the spec — `templateName` always
    //   wins as the file selector, otherwise `name` is the file selector
    //   AND is *not* passed through as a data prop.
    // * Resolve the file. JSX targets receive the props (plus ambient
    //   data) and `children` natively; Nunjucks targets receive props
    //   as block overrides (`extend` mode) or as data (`include` mode
    //   when called via `Template` against a Nunjucks file).
    jsxInvoke(req, callerModule, props, { mode, ambientData }) {
      const {
        templateName, name, ...rest
      } = props || {};
      let targetName;
      const dataProps = { ...rest };
      if (templateName !== undefined) {
        targetName = templateName;
        // Per spec: `name` is forwarded as a normal prop only when
        // `templateName` is also present.
        if (name !== undefined) {
          dataProps.name = name;
        }
      } else {
        targetName = name;
      }
      if (typeof targetName !== 'string') {
        throw new Error(
          'Template/Extend: pass a string to the `templateName` prop ' +
          '(or `name` when no other prop named `name` is needed).'
        );
      }
      return (async () => {
        const resolved = self.resolveTemplate(callerModule, targetName);
        if (!resolved) {
          throw new Error(`Template/Extend: could not resolve template "${targetName}".`);
        }
        if (resolved.kind === 'jsx') {
          // For JSX targets both Template and Extend behave the same:
          // the props (with the parent's ambient data underneath) are
          // passed straight through. JSX values like `children` flow as
          // node trees — they are flattened only when the target template
          // emits them.
          const targetModule = self.apos.modules[resolved.moduleName];
          const merged = {
            ...(ambientData || {}),
            ...dataProps
          };
          const html = await self.renderJsxTemplate(req, resolved, merged, targetModule);
          return new Raw(html);
        }
        // Nunjucks target.
        if (mode === 'extend') {
          return self.renderNunjucksWithBlocks(
            req, resolved, dataProps, ambientData
          );
        }
        // mode === 'include': render the Nunjucks template with our
        // props merged on top of ambient data, the same way a Nunjucks
        // `{% include %}` would inherit data.
        const flatProps = await self.flattenJsxProps(dataProps);
        const targetModule = self.apos.modules[resolved.moduleName];
        const data = {
          ...(ambientData || {}),
          ...flatProps
        };
        const html = await targetModule.render(req, resolved.relativeName, data);
        return new Raw(html);
      })();
    },

    // Invoke a Nunjucks template via `extends` so that JSX-supplied props
    // become `{% block %}` overrides. The synthetic Nunjucks template
    // declares one block per prop, each emitting the matching string
    // marked safe so already-rendered HTML survives.
    async renderNunjucksWithBlocks(req, resolved, props, ambientData) {
      const targetModule = self.apos.modules[resolved.moduleName];
      const blocks = {};
      for (const key of Object.keys(props)) {
        const html = await flattenToHtml(props[key]);
        blocks[key] = html;
      }
      const blockNames = Object.keys(blocks);
      const targetRef = `${resolved.moduleName}:${resolved.relativeName}`;
      const lines = [ `{% extends ${JSON.stringify(targetRef)} %}` ];
      for (const blockName of blockNames) {
        if (!/^[A-Za-z_][\w]*$/.test(blockName)) {
          throw new Error(
            `Template/Extend: prop names used as block overrides must be ` +
            `valid identifiers (got "${blockName}").`
          );
        }
        lines.push(
          `{% block ${blockName} %}{{ data.aposJsxBlocks[${JSON.stringify(blockName)}] | safe }}{% endblock %}`
        );
      }
      const synthetic = lines.join('\n');
      // Layer ambient page data underneath so the Nunjucks layout has
      // access to `data.outerLayout`, `data.page`, etc.; our blocks
      // override only what they explicitly name.
      const data = {
        ...(ambientData || {}),
        aposJsxBlocks: blocks
      };
      const html = await targetModule.renderString(req, synthetic, data);
      return new Raw(html);
    },

    // Walk a props object, flattening any JSX node values to HTML strings
    // so they can cross into Nunjucks (which can't deal with our internal
    // node arrays). Plain primitive props pass through unchanged.
    async flattenJsxProps(props) {
      const out = {};
      for (const key of Object.keys(props)) {
        const value = props[key];
        if (value === undefined) {
          continue;
        }
        if (isJsxNode(value)) {
          out[key] = self.safe(await flatten(value));
        } else {
          out[key] = value;
        }
      }
      return out;
    }
  };
};

// Decide whether a value should be flattened by the JSX runtime before
// being handed to Nunjucks. Arrays, Raw markers, and thenables produced
// by our helpers all need flattening; everything else (strings, numbers,
// docs, options objects) is forwarded as-is.
function isJsxNode(value) {
  if (value == null) {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value instanceof Raw) {
    return true;
  }
  if (typeof value === 'object' && typeof value.then === 'function') {
    return true;
  }
  return false;
}

// Convenience wrapper used when a JSX-supplied prop becomes a Nunjucks
// block override: regardless of input type, produce the final HTML string
// that the synthesized template will emit via the `safe` filter.
async function flattenToHtml(value) {
  if (value == null || value === false) {
    return '';
  }
  if (isJsxNode(value)) {
    return await flatten(value);
  }
  return String(value);
}

// Annotate exceptions thrown out of a JSX template with the file path so
// the error log clearly identifies which template failed. Source maps
// (installed by `jsxLoader`) take care of accurate line/column info.
function decorateJsxError(error, file) {
  if (!error || typeof error !== 'object') {
    return error;
  }
  if (!error.aposJsxFile) {
    error.aposJsxFile = file;
    error.message = `[JSX template ${file}] ${error.message}`;
  }
  return error;
}

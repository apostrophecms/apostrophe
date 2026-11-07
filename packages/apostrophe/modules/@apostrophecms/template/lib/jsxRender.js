// JSX render orchestration. Mixed into the `@apostrophecms/template`
// module by `index.js`, this file implements:
//
// * Template path resolution that walks the same module chain as Nunjucks
//   but knows about `.jsx` and prefers it when present alongside `.html`.
// * `renderJsxTemplate(req, resolved, data, module)` which loads the
//   compiled JSX module, invokes its default-exported function with
//   `(data, helpers)`, and flattens the resulting node tree into HTML.
// * The `Area`, `Field`, `Component`, `Template`, `Extend`, and `Widget`
//   runtime helpers exposed to JSX templates as the second argument to
//   their default function.
// * The cross-engine bridge: when a JSX template invokes `Template`/
//   `Extend` against a Nunjucks `.html` layout, the helper synthesizes a
//   Nunjucks string that extends the target and turns each named prop
//   into a `{% block ... %}` override.
// * The reverse bridge, for the outer layout only: when a project supplies
//   `outerLayout.jsx` or `refreshLayout.jsx`, Nunjucks templates that
//   `{% extends data.outerLayout %}` render against a stand-in that
//   captures their blocks, which are then passed as props to the JSX
//   layout. See `getJsxLayoutCaptureSource`.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const _ = require('lodash');

const jsxLoader = require('./jsxLoader.js');
const {
  Raw, flatten, registerSafeClass
} = require('./jsxRuntime.js');

const TEMPLATE_EXTENSIONS = [ 'jsx', 'njk', 'html' ];

// Outer layouts a project may write in JSX even though Nunjucks templates
// extend them. Every Nunjucks page template extends one of these through
// `data.outerLayout`.
const JSX_LAYOUT_NAMES = [ 'outerLayout', 'refreshLayout' ];

// The blocks of the stock `outerLayoutBase.html`. Blocks found in the
// project's resolved `outerLayoutBase` are added to these at render time.
const OUTER_LAYOUT_BLOCKS = [
  'locale', 'direction', 'extraHtml', 'encoding', 'startHead', 'title',
  'standardHead', 'extraHead', 'bodyClass', 'apostropheMenu',
  'apostropheUserInterface', 'beforeMain', 'mainAnchor', 'main',
  'afterMain', 'extraBody', 'afterAposScripts'
];

// Captured block markup is delimited with comments carrying a per-process
// random token, so page content can't forge or end a block.
const CAPTURE_TOKEN = crypto.randomBytes(12).toString('hex');
const CAPTURE_LAYOUT_PREFIX = '<!--apos-jsx-layout:';
const CAPTURE_DEFAULT = `<!--apos-jsx-default:${CAPTURE_TOKEN}-->`;
const CAPTURE_LAYOUT_RE = new RegExp(`<!--apos-jsx-layout:(\\w+):${CAPTURE_TOKEN}-->`);
const CAPTURE_BLOCK_RE = new RegExp(
  `<!--apos-jsx-block:(\\w+):${CAPTURE_TOKEN}-->([\\s\\S]*?)<!--/apos-jsx-block:${CAPTURE_TOKEN}-->`,
  'g'
);

module.exports = function(self) {
  return {
    // Install the global JSX `require` hook. Nunjucks `SafeString` instances
    // are taught to the runtime when Nunjucks loads, see `onNunjucksLoaded`.
    initJsx() {
      jsxLoader.install();
      registerSafeClass(JsxSafeString);
      // Read by `safe()` when Nunjucks is disabled.
      self.JsxSafeString = JsxSafeString;
    },

    // Called once, when Nunjucks is first loaded (or supplied via the
    // `language` option). Nunjucks `SafeString` instances pass through the
    // JSX runtime unescaped.
    //
    // From then on a `JsxSafeString`, as `safe()` returns in JSX mode, is
    // also an instance of the Nunjucks `SafeString`, so Nunjucks doesn't
    // escape it either, even if it was made before Nunjucks loaded.
    onNunjucksLoaded(nunjucks) {
      const { SafeString } = nunjucks.runtime;
      registerSafeClass(SafeString);
      if (!(JsxSafeString.prototype instanceof SafeString)) {
        Object.setPrototypeOf(JsxSafeString.prototype, SafeString.prototype);
      }
    },

    // True if `s` was marked safe by `safe()`, whichever class that used.
    // Never loads Nunjucks to find out.
    isSafeString(s) {
      if (s instanceof JsxSafeString) {
        return true;
      }
      if ((self.options.nunjucks === false) || !self.nunjucksLoaded()) {
        return false;
      }
      return s instanceof self.nunjucks.runtime.SafeString;
    },

    // True if Nunjucks has been loaded already.
    nunjucksLoaded() {
      return Boolean(require.cache[nunjucksPath()]) || Boolean(self.options.language);
    },

    // True when templates that exist in both forms in an installed module's
    // views folder render from `.jsx`. See the `jsx` and `nunjucks` options.
    isJsxMode() {
      return (self.options.jsx === true) || (self.options.nunjucks === false);
    },

    // True if `dir` is a views folder of one of Apostrophe's own modules.
    // Compared by real path, since Apostrophe may be reached through a
    // symlink.
    isCoreViewFolder(dir) {
      self.coreViewFolders = self.coreViewFolders || new Map();
      if (!self.coreViewFolders.has(dir)) {
        const core = realpath(path.join(self.apos.selfDir, 'modules')) + path.sep;
        self.coreViewFolders.set(dir, realpath(dir).startsWith(core));
      }
      return self.coreViewFolders.get(dir);
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

      const jsxMode = self.isJsxMode();
      for (const dir of dirs) {
        // Apostrophe's own modules ship both `.html` and `.jsx` versions of
        // their templates. Outside of JSX mode, the `.html` version wins, so
        // projects render exactly what they always have.
        const dirExts = (jsxMode || !exts.includes('jsx') || !self.isCoreViewFolder(dir))
          ? exts
          : [ ...exts.filter(ext => ext !== 'jsx'), 'jsx' ];
        for (const ext of dirExts) {
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

    // Called by the Nunjucks loader for every template it loads. Returns
    // the source of a stand-in template when `moduleName:modulePath` names
    // an outer layout (`outerLayout` or `refreshLayout` of this module)
    // that resolves to a `.jsx` file, otherwise `null`.
    //
    // Nunjucks can't extend a JSX template. The stand-in declares every
    // block of `outerLayoutBase`, each wrapped in markers, so a Nunjucks
    // template extending it renders to a list of its block overrides.
    // `renderBody` then hands those to the JSX layout as props, the same
    // props it receives when a JSX template uses `<Extend>`. A block the
    // child doesn't override is left out, so the JSX layout's own default
    // applies.
    getJsxLayoutCaptureSource(moduleName, modulePath) {
      if (moduleName !== self.__meta.name) {
        return null;
      }
      const m = modulePath.match(/^(\w+)(?:\.(html|njk))?$/);
      if (!m || !JSX_LAYOUT_NAMES.includes(m[1])) {
        return null;
      }
      const layoutName = m[1];
      const resolved = self.resolveTemplate(self, layoutName);
      if (!resolved || resolved.kind !== 'jsx') {
        return null;
      }
      const lines = [ `${CAPTURE_LAYOUT_PREFIX}${layoutName}:${CAPTURE_TOKEN}-->` ];
      for (const block of self.getOuterLayoutBlockNames()) {
        lines.push(
          `<!--apos-jsx-block:${block}:${CAPTURE_TOKEN}-->` +
          `{% block ${block} %}${CAPTURE_DEFAULT}{% endblock %}` +
          `<!--/apos-jsx-block:${CAPTURE_TOKEN}-->`
        );
      }
      return lines.join('\n');
    },

    // Names of the blocks a Nunjucks template can override when it extends
    // the outer layout: those of the stock `outerLayoutBase.html` plus any
    // a project-level `outerLayoutBase` override adds.
    getOuterLayoutBlockNames() {
      const names = new Set(OUTER_LAYOUT_BLOCKS);
      const base = self.resolveTemplate(self, 'outerLayoutBase');
      if (base && base.kind === 'nunjucks') {
        const src = fs.readFileSync(base.path, 'utf8');
        for (const match of src.matchAll(/{%-?\s*block\s+(\w+)/g)) {
          names.add(match[1]);
        }
      }
      return [ ...names ];
    },

    // True if `html` is the output of a Nunjucks template that extended a
    // stand-in from `getJsxLayoutCaptureSource`.
    isJsxLayoutCapture(html) {
      return (typeof html === 'string') &&
        html.includes(CAPTURE_LAYOUT_PREFIX) &&
        CAPTURE_LAYOUT_RE.test(html);
    },

    // Render the JSX outer layout named in `captured` (see
    // `getJsxLayoutCaptureSource`), passing each captured block as a prop
    // alongside the data the Nunjucks template was rendered with.
    async renderJsxLayoutCapture(req, captured, data, module) {
      const layoutName = captured.match(CAPTURE_LAYOUT_RE)[1];
      const blocks = {};
      for (const [ , name, content ] of captured.matchAll(CAPTURE_BLOCK_RE)) {
        if (content === CAPTURE_DEFAULT) {
          continue;
        }
        blocks[name] = content.includes(CAPTURE_DEFAULT)
          // The block called super(). Pass a function, which the layout
          // calls with its default markup for the block: see `block` in
          // `jsxLayout.js`.
          ? superBlock(content.split(CAPTURE_DEFAULT))
          : new Raw(content);
      }
      const resolved = self.resolveTemplate(self, layoutName);
      if (!resolved || resolved.kind !== 'jsx') {
        throw new Error(`The JSX layout ${layoutName}.jsx is no longer available.`);
      }
      const renderData = {
        ...self.getRenderDataArgs(req, data, module),
        ...blocks
      };
      // Set by `renderNunjucksWithBlocks` for the Nunjucks template's own
      // use, not data the layout should see.
      delete renderData.aposJsxBlocks;
      const targetModule = self.apos.modules[resolved.moduleName];
      return self.renderJsxTemplate(req, resolved, renderData, targetModule);
    },

    // Render the JSX module at `resolved.path` against `data`. Loads the
    // compiled module via Node's require (the `.jsx` extension hook
    // installed by `jsxLoader` does the Babel transform on first load),
    // calls its default function, and flattens the returned node tree.
    async renderJsxTemplate(req, resolved, data, module) {
      self.watchJsxRenderTargets(module, resolved);
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

    // Build the `{ apos, helpers, Area, Field, Component, Extend, Template,
    // Widget, ... }` object passed as the second argument to every JSX
    // template. The closure captures `req`, `module` (the module whose
    // template is currently being rendered, used to resolve `Template`
    // names without a `module:` prefix), and `ambientData` (the merged
    // render data for the current invocation, threaded through
    // `Template`/`Extend` to mirror Nunjucks' `extends` semantics).
    buildJsxHelpers(req, module, ambientData) {
      const helpers = {
        // Full `self.apos`. Unlike Nunjucks, JSX supports await, so
        // there is no need to restrict access to this object.
        apos: self.apos,
        // The Nunjucks-compatible wrapper. Carries `addHelpers`-registered
        // helpers under `helpers.modules['module-name'].method(...)` and
        // module aliases, matching the `apos` object available in
        // Nunjucks templates. Distinct from the JSX `apos` above.
        helpers: self.templateApos,
        // Localization helper, matching the Nunjucks `__t` global.
        __t: req.t && req.t.bind(req),

        Area: (props) => self.jsxArea(req, props),
        Field: (props) => self.jsxField(req, props),
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

    // Implementation of the `<Field doc={..} name=".." with={..} />` helper,
    // the JSX equivalent of the `{% field %}` custom tag. Renders one field of
    // a doc, widget, array item or object and lets the user edit it in place,
    // right where it appears on the page. If the field is an area this is
    // exactly `<Area>`.
    jsxField(req, props) {
      const {
        doc, name, with: ctx
      } = props || {};
      const usage = (message) => new Error(`${message}

Usage: <Field doc={data.page} name='fieldName' with={{ tag: 'h2' }} />`);
      return (async () => {
        const html = await self.apos.schema.renderFieldTag(
          req, doc, name, ctx, { usage }
        );
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
        const inputProps = await self.flattenJsxProps({
          ...rest,
          children
        });
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
        // `{% include %}` would inherit data. Like variables of a template
        // calling `{% include %}`, the props are also visible by name.
        const flatProps = await self.flattenJsxProps(dataProps);
        const targetModule = self.apos.modules[resolved.moduleName];
        const data = {
          ...(ambientData || {}),
          ...flatProps
        };
        const html = await self.renderBody(
          req, 'file', resolved.relativeName, data, targetModule, flatProps
        );
        return new Raw(html);
      })();
    },

    // Invoke a Nunjucks template via `extends` so that JSX-supplied props
    // become `{% block %}` overrides. The synthetic Nunjucks template
    // declares one block per prop, each emitting the matching string
    // marked safe so already-rendered HTML survives.
    //
    // A prop may also be a function, which receives the block's default
    // markup, as Nunjucks `super()` would supply it, and returns the markup
    // to use instead.
    async renderNunjucksWithBlocks(req, resolved, props, ambientData) {
      const targetModule = self.apos.modules[resolved.moduleName];
      const blocks = {};
      const wrappers = {};
      for (const key of Object.keys(props)) {
        // An undefined prop leaves the block alone, so a layout can forward
        // its props unconditionally, e.g. `<Extend title={title} />`.
        if (props[key] === undefined) {
          continue;
        }
        if (typeof props[key] === 'function') {
          wrappers[key] = props[key];
          continue;
        }
        const html = await flattenToHtml(props[key]);
        blocks[key] = html;
      }
      const blockNames = [ ...Object.keys(blocks), ...Object.keys(wrappers) ];
      const targetRef = `${resolved.moduleName}:${resolved.relativeName}`;
      const lines = [ `{% extends ${JSON.stringify(targetRef)} %}` ];
      for (const blockName of blockNames) {
        if (!/^[A-Za-z_][\w]*$/.test(blockName)) {
          throw new Error(
            'Template/Extend: prop names used as block overrides must be ' +
            `valid identifiers (got "${blockName}").`
          );
        }
        if (wrappers[blockName]) {
          // Mark where the default lands, then hand it to the function.
          lines.push(
            `{% block ${blockName} %}${superStart(blockName)}{{ super() }}` +
            `${superEnd(blockName)}{% endblock %}`
          );
          continue;
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
      let html = await targetModule.renderString(req, synthetic, data);
      for (const [ name, wrapper ] of Object.entries(wrappers)) {
        const start = superStart(name);
        const end = superEnd(name);
        let from = 0;
        let at;
        while ((at = html.indexOf(start, from)) !== -1) {
          const close = html.indexOf(end, at + start.length);
          if (close === -1) {
            break;
          }
          const markup = await flattenToHtml(
            wrapper(new Raw(html.substring(at + start.length, close)))
          );
          html = html.substring(0, at) + markup + html.substring(close + end.length);
          from = at + markup.length;
        }
      }
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

// Marks a string as markup that must not be escaped, when Nunjucks (and its
// own SafeString) is disabled. Behaves like a Nunjucks SafeString: it
// converts to its string, and the JSX runtime outputs it as is.
class JsxSafeString {
  constructor(val) {
    // Like a Nunjucks SafeString, an object is returned as it is: helpers
    // such as `apos.styles.render()` rely on it.
    if ((val !== null) && (typeof val === 'object')) {
      return val;
    }
    this.val = (val == null) ? '' : String(val);
    this.length = this.val.length;
  }

  toString() {
    return this.val;
  }

  valueOf() {
    return this.val;
  }
}

// `fs.realpathSync`, for a path that may not exist.
function realpath(p) {
  try {
    return fs.realpathSync(p);
  } catch (e) {
    return path.resolve(p);
  }
}

let nunjucksResolved;
function nunjucksPath() {
  if (!nunjucksResolved) {
    nunjucksResolved = require.resolve('nunjucks');
  }
  return nunjucksResolved;
}

// Markers around the default markup of a block that a JSX prop wraps, see
// `renderNunjucksWithBlocks`.
function superStart(name) {
  return `<!--apos-jsx-super:${name}:${CAPTURE_TOKEN}-->`;
}

function superEnd(name) {
  return `<!--/apos-jsx-super:${name}:${CAPTURE_TOKEN}-->`;
}

// A block prop for captured Nunjucks markup that called `super()`. `parts` is
// that markup split where `super()` output the default. Called with the
// layout's default for the block, it returns the markup with the default
// in each of those places.
//
// A layout that outputs the prop without calling it gets the markup with
// nothing in those places.
function superBlock(parts) {
  const fn = (fallback) => (async () => {
    // The default is JSX output: a plain string in it is text, and escaped
    const markup = await flatten(fallback);
    return new Raw(parts.join(markup));
  })();
  fn.aposBlock = true;
  return fn;
}

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
  if ((typeof value === 'function') && value.aposBlock) {
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

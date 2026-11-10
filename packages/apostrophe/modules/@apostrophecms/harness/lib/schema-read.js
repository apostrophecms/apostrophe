// The schema read: a type's fields as AI reads them, one compact line per
// field, top-level fields under the editor's groups.

// Value shapes the model can't tell from a field type's name, given once
// per read for the types it contains
const LEGEND = {
  intro: 'One line per field: "name: type, details". Indented lines are the fields of ' +
    'an array item, an object or a relationship entry ("_fields"). "if" names the ' +
    'condition under which the editor shows a field; "required if" the one under which ' +
    'it is required. A "readonly" field is refused on write. "default" is the value a ' +
    'field takes when a new item omits it.',
  style: 'style: the CSS property the field sets, and its unit; "style class": it ' +
    'adds a class instead.',
  area: 'area: the widget types it accepts, in [ ]; "html A" after one names the ' +
    'markup a save keeps in it.',
  html: 'html: rich text markup. "html A" names the markup a save keeps, listed as ' +
    '"markup A" below; a save removes any other tag. Attributes and inline styles ' +
    'are not listed.',
  relationship: 'relationship → type: an array of {"_id"} of documents of that type, ' +
    'found with search_content.',
  box: 'box: {"top", "right", "bottom", "left"}, integers in the field\'s unit, null ' +
    'for a side left unset.',
  color: 'color: a CSS color ("#1e90ff", "rgb(30 144 255)", a color name) or a CSS ' +
    'custom property name ("--brand-blue"); any other value is stored empty.',
  range: 'range: a number within its bounds, a multiple of its step.',
  folded: 'folded: a conditional field\'s own fields are left out; read them with ' +
    'get_schema "fields", by dot path of field names ("details.author"), one type at a time.'
};

const OPERATORS = {
  $eq: '=',
  $ne: '!=',
  $gt: '>',
  $gte: '>=',
  $lt: '<',
  $lte: '<=',
  $in: ' in ',
  $nin: ' not in '
};

module.exports = (self) => {
  return {
    /**
     * The schema read of one doc or widget type: its AI-facing schema, one
     * line per field, top-level fields under `## <group>` headings in the
     * editor's order. A field shown under a condition (`if`) has its own
     * fields folded, at any depth; `fields` reads such fields in full, each
     * with its whole subtree. Dynamic choices are resolved for `req`.
     *
     * @param {object} req
     * @param {object} manager A doc type or widget type manager.
     * @param {object} [options]
     * @param {Set<string>} [options.legend] Collects the legend entries the
     *   lines need (see `getSchemaLegend`).
     * @param {Map<string, string>} [options.markup] Collects the markup sets
     *   the lines name, each to be listed once in the legend: the name of
     *   each set by its list of markup.
     * @param {string[]} [options.fields] Dot paths of field names to read in
     *   full instead of the whole schema.
     * @returns {Promise<string[]>}
     */
    async renderSchema(req, manager, {
      legend = new Set(), markup = new Map(), fields
    } = {}) {
      const schema = self.getAiSchemaOf(req, manager);
      if (fields) {
        const lines = [];
        for (const path of fields) {
          const field = findField(schema, path.split('.'));
          lines.push(...(field
            ? await renderField(field, '', {
              unfold: true,
              name: path
            })
            : [ `${path}: no such field` ]));
        }
        return lines;
      }
      const lines = [];
      let group = null;
      for (const field of schema) {
        const name = field.group?.name || null;
        if (name && (name !== group)) {
          lines.push(`## ${name}`);
          group = name;
        }
        lines.push(...await renderField(field, ''));
      }
      return lines;

      async function renderField(field, indent, {
        unfold = false, name = field.name
      } = {}) {
        if (field.type === 'relationshipReverse') {
          return [];
        }
        // A relationship's entry fields set through its type's own editor
        // (an image's crop) are not for AI
        const ownEditor = (field.type === 'relationship') &&
          self.apos.doc.getManager(field.withType)?.options.relationshipEditor;
        const nested = [ 'array', 'object', 'relationship' ].includes(field.type) && !ownEditor
          ? (field.schema || []).filter(({ type }) => type !== 'relationshipReverse')
          : [];
        const folded = !unfold && (nested.length > 0) && isConditional(field);
        const parts = [];
        if ((field.property !== undefined) || field.class) {
          legend.add('style');
          parts.push((field.property === undefined)
            ? 'style class'
            : [ `style ${[ field.property ].flat().join(' ')}`, field.unit ]
              .filter(Boolean).join(', '));
        }
        parts.push(await renderType(field));
        if (folded) {
          legend.add('folded');
          parts.push(`${nested.length} ${(nested.length === 1) ? 'field' : 'fields'} folded`);
        }
        if (isConditional(field)) {
          parts.push(`if ${formatCondition(field.if)}`);
        }
        if (field.requiredIf && Object.keys(field.requiredIf).length) {
          parts.push(`required if ${formatCondition(field.requiredIf)}`);
        } else if (field.required) {
          parts.push('required');
        }
        if (field.readOnly) {
          parts.push('readonly');
        }
        if (field.type !== 'area') {
          parts.push(formatDefault(field.def));
        }
        const help = field.help
          ? self.translate(req, field.help)
          : field.htmlHelp &&
            self.apos.util.htmlToPlaintext(self.translate(req, field.htmlHelp));
        if (help?.trim()) {
          parts.push(`help ${JSON.stringify(help.trim())}`);
        }
        const lines = [ `${indent}${name}: ${parts.filter(Boolean).join(', ')}` ];
        for (const child of folded ? [] : nested) {
          lines.push(...await renderField(child, `${indent}  `, { unfold }));
        }
        return lines;
      }

      function isConditional(field) {
        return Boolean(field.if && Object.keys(field.if).length);
      }

      // The field at `names`, through the fields of arrays, objects and
      // relationship entries
      function findField(schema, [ name, ...rest ]) {
        const field = schema.find(field => field.name === name);
        return (field && rest.length)
          ? findField(field.schema || [], rest)
          : field;
      }

      async function renderType(field) {
        // A field type that keeps only some markup, as rich text does
        const fieldType = self.apos.schema.fieldTypes[field.type];
        if (fieldType?.getSanitizeHtmlOptions) {
          legend.add('html');
          const name = getMarkupName(fieldType.getSanitizeHtmlOptions(field));
          return name ? `html ${name}` : 'html';
        }
        const bounds = [
          (field.min !== undefined) && `min ${field.min}`,
          (field.max !== undefined) && `max ${field.max}`
        ];
        switch (field.type) {
          case 'area': {
            legend.add('area');
            const widgets = Object.entries(self.apos.area.getWidgets(field.options || {}))
              .filter(([ type ]) => self.apos.area.getWidgetManager(type))
              .map(([ type, options ]) => {
                // A widget type that keeps only some markup, as rich text does
                const manager = self.apos.area.getWidgetManager(type);
                const name = manager.getSanitizeHtmlOptions &&
                  getMarkupName(manager.getSanitizeHtmlOptions(options));
                return name ? `${type} html ${name}` : type;
              });
            return [
              `area [${widgets.join(', ')}]`,
              (field.options?.min !== undefined) && `min ${field.options.min}`,
              (field.options?.max !== undefined) && `max ${field.options.max}`
            ].filter(Boolean).join(', ');
          }
          case 'relationship':
            legend.add('relationship');
            return [ `relationship → ${field.withType}`, ...bounds ]
              .filter(Boolean).join(', ');
          case 'range':
            legend.add('range');
            return [
              `range ${field.min}–${field.max}`,
              (field.step !== undefined) && (field.step !== 1) && `step ${field.step}`
            ].filter(Boolean).join(', ');
          case 'box':
          case 'color':
            legend.add(field.type);
            return [ field.type, ...bounds ].filter(Boolean).join(', ');
          default: {
            const choices = await getChoices(field);
            return [
              choices ? `${field.type} ${choices}` : field.type,
              ...bounds
            ].filter(Boolean).join(', ');
          }
        }
      }

      // `[a, b]` for a field with choices, dynamic ones resolved; `null`
      // without choices
      async function getChoices(field) {
        if (Array.isArray(field.choices)) {
          return `[${field.choices.map(choice => formatValue(choice.value)).join(', ')}]`;
        }
        if ((typeof field.choices !== 'string') ||
          !self.apos.schema.fieldTypes[field.type]?.dynamicChoices) {
          return null;
        }
        if (field.following) {
          return `(choices depend on ${[ field.following ].flat().join(', ')})`;
        }
        const choices = await self.apos.schema.evaluateMethod(
          req,
          field.choices,
          field.name,
          field.moduleName,
          null,
          true
        );
        return Array.isArray(choices)
          ? `[${choices.map(choice => formatValue(choice.value)).join(', ')}]`
          : null;
      }

      // The name of the markup sanitize-html `options` keep (`p, br, strong,
      // p.lead`: tags, then classes as `tag.class`), added to `markup` the
      // first time; `null` when they keep any tag
      function getMarkupName(options) {
        if (!Array.isArray(options.allowedTags)) {
          return null;
        }
        legend.add('html');
        const classes = Object.entries(options.allowedClasses || {})
          .flatMap(([ tag, names ]) => [ names ].flat().map(name => `${tag}.${name}`));
        const list = [ ...new Set([ ...options.allowedTags, ...classes ]) ].join(', ');
        if (!markup.has(list)) {
          markup.set(list, getName(markup.size));
        }
        return markup.get(list);
      }
    },

    // The legend lines for the entries and markup sets `renderSchema`
    // collected
    getSchemaLegend(legend, markup = new Map()) {
      return [
        LEGEND.intro,
        ...Object.keys(LEGEND).filter(key => legend.has(key)).map(key => LEGEND[key]),
        ...[ ...markup ].map(([ list, name ]) => `markup ${name}: ${list}`)
      ].join('\n');
    }
  };
};

// A markup set's name by its number: A to Z, then A27, A28…
function getName(index) {
  return (index < 26) ? String.fromCharCode(65 + index) : `A${index + 1}`;
}

// `a=x and (b>=2 or c in [d, e])` for a MongoDB-style condition
function formatCondition(clause) {
  return Object.entries(clause).map(([ key, value ]) => {
    if ((key === '$or') || (key === '$and')) {
      const joined = value.map(formatCondition).join(key === '$or' ? ' or ' : ' and ');
      return (value.length > 1) ? `(${joined})` : joined;
    }
    if (!value || (typeof value !== 'object') || Array.isArray(value)) {
      return `${key}=${formatValue(value)}`;
    }
    return Object.entries(value).map(([ operator, operand ]) => {
      if (operator === '$exists') {
        return `${key} ${operand ? 'set' : 'unset'}`;
      }
      return OPERATORS[operator]
        ? `${key}${OPERATORS[operator]}${formatValue(operand)}`
        : `${key} ${operator} ${formatValue(operand)}`;
    }).join(' and ');
  }).join(' and ');
}

// A value as a line shows it: a plain word as is, anything else as JSON
function formatValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`;
  }
  return ((typeof value === 'string') && /^[\w@./:#-]+$/.test(value))
    ? value
    : JSON.stringify(value);
}

// `default x` for a default worth saying, `null` otherwise
function formatDefault(def) {
  const empty = (def === undefined) || (def === null) || (def === '') ||
    (Array.isArray(def) && !def.length) ||
    ((typeof def === 'object') && !Array.isArray(def) &&
      Object.values(def).every(value => value === null));
  return empty ? null : `default ${formatValue(def)}`;
}

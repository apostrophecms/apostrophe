module.exports = {
  options: {
    name: 'box',
    alias: 'boxField'
  },
  init(self) {
    self.name = self.options.name;
    self.addFieldType();
    self.enableBrowserData();
  },
  methods(self) {
    return {
      addFieldType() {
        self.apos.schema.addFieldType({
          name: 'box',
          convert(req, field, data, destination) {
            const defProps = [ 'top', 'right', 'bottom', 'left' ];
            const temp = {};
            const min = self.apos.launder.integer(field.min);
            let max = null;

            if ('max' in field) {
              max = self.apos.launder.integer(field.max);
            }

            // All values to numbers or null
            defProps.forEach(side => {
              const int = parseInt(data[field.name][side]);
              if (int || int === 0) {
                temp[side] = int;
              } else {
                temp[side] = null;
              }
            });

            // One non-null value if required
            if (field.required) {
              const unique = [ ...new Set(Object.values(temp)) ];
              if (unique.length === 1 && unique[0] === null) {
                throw self.apos.error('required');
              }
            }

            // Minimum values in range
            for (const key of defProps) {
              if (temp[key] && temp < min) {
                throw self.apos.error(`${key} is below the min ${field.min}, is ${temp[key]}`);
              }
            }

            // Maximum values in range
            if (max) {
              for (const key of defProps) {
                if (temp[key] && temp[key] > field.max) {
                  throw self.apos.error(`${key} is greater than the max ${field.max}, is ${temp[key]}`);
                }
              }
            }

            // Copy values to destination
            destination[field.name] = temp;
          },
          validate(field, options, warn, fail) {
            const defProps = [ 'top', 'right', 'bottom', 'left' ];
            let defMin = 0;

            if (field.max && typeof field.max !== 'number') {
              fail('Property "max" must be a number');
            }

            if (field.step && typeof field.step !== 'number') {
              fail('Property "step" must be a number');
            }

            if (field.def) {
              const fieldDefProps = Object.keys(field.def);
              if (
                !(fieldDefProps.length === defProps.length &&
                fieldDefProps.every(k => defProps.includes(k)))
              ) {
                fail('Def must be an object with only "top", "right", "bottom", and "left" keys');
              }

              for (const key in field.def) {
                if (!Number.isFinite(field.def[key])) {
                  fail(`Default property "${key}" must be a number`);
                }
              }
            }

            if (field.min) {
              if (typeof field.min !== 'number') {
                fail('Property "min" must be a number');
              }
            } else {
              if (field.def) {
                // if def has a negative value, it needs to be the min
                const fieldDefMin = Math.min(...Object.values(field.def));
                if (defMin > fieldDefMin) {
                  defMin = fieldDefMin;
                }
              }
              field.min = defMin;
            }

          },
          def: {
            top: null,
            right: null,
            bottom: null,
            left: null
          }
        });
      },
      getBrowserData(req) {
        return {
          name: self.name,
          action: self.action
        };
      }
    };
  },
  helpers() {
    return {
      toCss(value, property, unit = 'px') {
        const {
          top, right, bottom, left
        } = value;
        const vals = [ top, right, bottom, left ];

        if (vals.every(v => v == null)) {
          return '';
        };

        if (vals.every(v => v === top && v != null)) {
          const normalizedProperty = property
            .replaceAll('-%key%', '')
            .replaceAll('%key%-', '');

          return `${normalizedProperty}: ${top}${unit};`;
        }

        const sides = {
          top,
          right,
          bottom,
          left
        };
        const parts = [];

        for (const [ side, val ] of Object.entries(sides)) {
          if (val == null) {
            continue;
          }

          const normalizedProperty = property.includes('%key%')
            ? property
              .replaceAll('-%key%', `-${side}`)
              .replaceAll('%key%-', `${side}-`)
            : `property-${side}`;

          parts.push(`${normalizedProperty}: ${val}${unit}`);
        }

        return parts.join(' ');
      }
    };
  }
};

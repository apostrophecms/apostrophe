/**
 * Default unit mappings from viewport to container query units
 */
const DEFAULT_UNITS = {
  vh: 'cqh',
  vw: 'cqw',
  vmin: 'cqmin',
  vmax: 'cqmax',
  dvh: 'cqh',
  dvw: 'cqw',
  lvh: 'cqh',
  lvw: 'cqw',
  svh: 'cqh',
  svw: 'cqw'
};

/**
 * Default plugin options
 */
const DEFAULT_OPTIONS = {
  units: DEFAULT_UNITS,
  containerEl: 'body',
  modifierAttr: 'data-breakpoint-preview-mode',
  debug: false,
  transform: null,
  debugFilter: null
};

module.exports = {
  DEFAULT_UNITS,
  DEFAULT_OPTIONS
};

export function finalOptions(defaults, options) {
  let final = { ...options };

  // Handle BC `pickerOptions` sub object.
  // Modern API wins out over BC conflicts
  if (final.pickerOptions) {
    final = {
      ...final.pickerOptions,
      ...final
    };
    delete final.pickerOptions;
  }

  // Normalize disabling presetColors
  if (
    Array.isArray(final.presetColors) &&
    final.presetColors.length === 0
  ) {
    final.presetColors = false;
  }

  // If `true`, let defaults through
  if (final.presetColors === true) {
    delete final.presetColors;
  }

  return Object.assign({ ...defaults }, final);
};

import checkIfConditions from 'apostrophe/lib/universal/check-if-conditions.mjs';

export function isOperationDisabled(operation, props) {
  if (operation.disabledIfProps) {
    return checkIfConditions(props, operation.disabledIfProps) || false;
  }
  return false;
}

export function getOperationTooltip(operation, {
  disabled = false,
  placement = 'left'
} = {}) {
  const content = disabled && operation.disabledTooltip
    ? operation.disabledTooltip
    : operation.tooltip;

  return {
    content,
    placement
  };
}

function computeMinSizes(minSize, aspectRatio) {
  const minWidth = minSize[0];
  const minHeight = minSize[1];
  const _aspectRatio = Array.isArray(aspectRatio)
    ? aspectRatio[0] / aspectRatio[1]
    : aspectRatio;

  if (!_aspectRatio) {
    return {
      minWidth,
      minHeight
    };
  }

  // If ratio wants a square,
  // we simply take the higher min size
  if (_aspectRatio === 1) {
    const higherValue = Math.max(minWidth, minHeight);

    return {
      minWidth: higherValue,
      minHeight: higherValue
    };
  }

  const diff = minWidth / minHeight - _aspectRatio;

  if (diff > 0) {
    return {
      minWidth,
      minHeight: minWidth / _aspectRatio
    };
  }

  if (diff < 0) {
    return {
      minWidth: minHeight * _aspectRatio,
      minHeight
    };
  }

  return {
    minWidth,
    minHeight
  };
};

module.exports = {
  computeMinSizes
};

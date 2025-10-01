function computeMinSizes(minSize, aspectRatio) {
  const minWidth = minSize[0];
  const minHeight = minSize[1];
  const _aspectRatio = Array.isArray(aspectRatio)
    ? aspectRatio[0] / aspectRatio[1]
    : aspectRatio;

  console.log('minWidth', minWidth);
  console.log('minHeight', minHeight);
  console.log('aspectRatio', _aspectRatio);

  if (!_aspectRatio) {
    return {
      minWidth,
      minHeight
    };
  }

  // If ratio wants a square,
  // we simply take the higher min size
  if (_aspectRatio === 1) {
    const higherValue = minWidth > minHeight
      ? minWidth
      : minHeight;

    return {
      minWidth: higherValue,
      minHeight: higherValue
    };
  }

  const minSizeRatio = minHeight / minWidth;
  const ratio = minSizeRatio * _aspectRatio;

  if (ratio > 1) {
    return {
      minWidth: Math.round(minHeight * _aspectRatio),
      minHeight
    };
  } else if (ratio < 1) {
    return {
      minWidth,
      minHeight: Math.round(minWidth / _aspectRatio)
    };
  }
};

module.exports = {
  computeMinSizes
};

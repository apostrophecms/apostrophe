function computeMinSizes([ minWidth, minHeight ], aspectRatio) {
  const aspectRatioFloat = Array.isArray(aspectRatio)
    ? aspectRatio[0] / aspectRatio[1]
    : aspectRatio;

  if (!aspectRatioFloat) {
    return {
      minWidth,
      minHeight
    };
  }

  // If ratio wants a square,
  // we simply take the higher min size
  if (aspectRatioFloat === 1) {
    const higherValue = Math.max(minWidth, minHeight);

    return {
      minWidth: higherValue,
      minHeight: higherValue
    };
  }

  const diff = minWidth / minHeight - aspectRatioFloat;

  if (diff > 0) {
    return {
      minWidth,
      minHeight: minWidth / aspectRatioFloat
    };
  }

  if (diff < 0) {
    return {
      minWidth: minHeight * aspectRatioFloat,
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

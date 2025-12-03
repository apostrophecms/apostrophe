const findMissing = (theirs, ours) =>
  Object.keys(theirs).filter(rule => !Object.keys(ours).includes(rule));

const diff = (theirs, ours) => {
  const variants = new Map();

  const rules = Object.keys(ours);
  rules.forEach(rule => {
    if (JSON.stringify(ours[rule]) === JSON.stringify(theirs[rule])) {
      return;
    }

    variants.set(rule, {
      standard: theirs[rule],
      modified: ours[rule]
    });
  });

  return variants;
};

module.exports = {
  findMissing,
  diff
};

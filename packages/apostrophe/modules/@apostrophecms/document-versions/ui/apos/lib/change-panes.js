// The expanded row's two sides, newer first. A side shows the words both
// sides share and its own changed words.
export default [
  {
    side: 'new',
    tag: 'ins',
    label: 'apostrophe:versionThisVersion',
    icon: 'plus-circle-icon',
    markLabel: 'apostrophe:versionAddedText'
  },
  {
    side: 'old',
    tag: 'del',
    label: 'apostrophe:versionPreviousVersion',
    icon: 'minus-circle-icon',
    markLabel: 'apostrophe:versionRemovedText'
  }
];

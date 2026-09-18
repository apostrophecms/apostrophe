// Consolidated versions: consecutive versions one author saved with and
// without AI display as one list item. Pure functions over version records,
// newest first, reading `authorId`, `mode`, `ai` and `restoredFrom` only.
// Nothing here changes a record; the stored versions stay as they are.
//
// A sequence is a stretch of consecutive draft versions by one author, none
// of them a restore. A sequence consolidates when it holds at least one
// version saved with AI and one saved without; the versions of any other
// sequence display alone.

module.exports = {
  inSameSequence,
  getSequences,
  consolidates,
  consolidate
};

// Whether two neighbouring versions belong to one sequence
function inSameSequence(one, two) {
  return canJoin(one) && canJoin(two) &&
    (one.authorId ?? null) === (two.authorId ?? null);
}

// The sequences of `versions`, in order, each an array of at least one
// version. The last one is complete only when the version after it is known
// not to continue it
function getSequences(versions) {
  const sequences = [];
  for (const version of versions) {
    const sequence = sequences.at(-1);
    if (sequence && inSameSequence(sequence.at(-1), version)) {
      sequence.push(version);
    } else {
      sequences.push([ version ]);
    }
  }
  return sequences;
}

// Whether the versions of `sequence` display as one
function consolidates(sequence) {
  return sequence.some(version => version.ai) &&
    sequence.some(version => !version.ai);
}

// The list items for `versions`: a sequence that consolidates becomes one
// consolidated version, its newest version's fields with `ai: true`,
// `versionIds` (every version it stands for, newest first) and no
// `changeCount`, which only the caller can compute; any other version is
// its own item, as is
function consolidate(versions) {
  return getSequences(versions).flatMap(sequence => {
    if (!consolidates(sequence)) {
      return sequence;
    }
    const { changeCount, ...newest } = sequence[0];
    return [ {
      ...newest,
      ai: true,
      versionIds: sequence.map(version => version._id)
    } ];
  });
}

function canJoin(version) {
  return version.mode === 'draft' && !version.restoredFrom;
}

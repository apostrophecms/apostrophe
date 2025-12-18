// Function to determine type based on summary content
function getChangeType(summary, originalType) {
  const lowerSummary = summary.toLowerCase().trim();

  // Check for prefixes
  if (lowerSummary.startsWith("added:")) {
    return "Adds";
  }

  if (lowerSummary.startsWith("changed:")) {
    return "Changes";
  }

  // Patch is always "Fixed"
  if (originalType === "patch") {
    return "Fixes";
  }

  // Fallback for major/minor without prefix
  return originalType === "major" ? "Adds" : "Changes";
}

// Function to clean the summary (remove the prefix if present)
function cleanSummary(summary) {
  return summary
    .replace(/^added:\s*/i, '')
    .replace(/^changed:\s*/i, '');
}

module.exports = {
  getReleaseLine: async (changeset, type) => {
    console.log('changeset', changeset)
    console.log('type', type)
    const [firstLine, ...futureLines] = changeset.summary
      .split("\n")
      .map((l) => l.trimRight());

    console.log('firstLine', firstLine)
    console.log('futureLines', futureLines)

    // Determine the change type based on summary content
    const changeType = getChangeType(firstLine, type);

    // Clean the summary to remove the prefix
    const cleanedFirstLine = cleanSummary(firstLine);

    // Capitalize first letter of cleaned summary
    const formattedSummary = cleanedFirstLine.charAt(0).toUpperCase() + cleanedFirstLine.slice(1);

    // Format the release line
    let releaseLine = `- **${changeType}**: ${formattedSummary}`;

    // Add additional lines if they exist
    if (futureLines.length > 0) {
      releaseLine += `\n${futureLines.map(l => `  ${l}`).join("\n")}`;
    }

    console.log('releaseLine', releaseLine)
    return releaseLine;
  },

  getDependencyReleaseLine: async (changesets, dependenciesUpdated) => {
    if (dependenciesUpdated.length === 0) return "";

    const updatedDependencies = dependenciesUpdated.map(
      (dependency) => `  - ${dependency.name}@${dependency.newVersion}`
    );

    return `- **Dependencies Updated:**\n${updatedDependencies.join("\n")}`;
  }
};

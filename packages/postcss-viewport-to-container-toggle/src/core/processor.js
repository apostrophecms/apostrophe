const createUnitConverter = require('../utils/unitConverter');
const createMediaProcessor = require('../utils/mediaProcessor');
const createRuleProcessor = require('../utils/ruleProcessor');
const createDebugUtils = require('../utils/debug');
const createSelectorHelper = require('../utils/selectorHelper');
const { DEFAULT_OPTIONS } = require('../constants/defaults');

const createCoreProcessor = (opts = {}) => {
  const options = {
    ...DEFAULT_OPTIONS,
    ...opts
  };
  const { containerEl, modifierAttr } = options;

  const conditionalSelector = `${containerEl}[${modifierAttr}]`;
  const conditionalNotSelector = `${containerEl}:not([${modifierAttr}])`;
  const containerBodySelector = '[data-apos-refreshable-body]';

  const unitConverter = createUnitConverter({ units: options.units });
  const debugUtils = createDebugUtils(options);
  const mediaProcessor = createMediaProcessor({ ...options });
  // We will need to wrap ruleProcessor to use adapter, or update it.
  // For now, let's assume we pass adapter to it or it uses standard methods
  // that adapter supports.
  // Actually ruleProcessor uses `walkDecls` which is standard PostCSS.
  // If our adapter exposes the node as something that has `walkDecls`,
  // we might be fine.
  // But for "pure JS" browser implementation, our custom nodes need to have
  // `walkDecls`.
  const ruleProcessor = createRuleProcessor({
    ...options,
    unitConverter
  });
  const selectorHelper = createSelectorHelper({ modifierAttr });

  let hasAddedContainerContext = false;

  const isSameMediaQuery = (mq1, mq2, adapter) => {
    // We need source comparison. Adapter should provide source info or equality check.
    return adapter.getParams(mq1) === adapter.getParams(mq2) &&
      adapter.getSourceStartLine(mq1) === adapter.getSourceStartLine(mq2);
  };

  const addContainerContextIfNeeded = (root, adapter) => {
    if (hasAddedContainerContext) {
      return;
    }

    let needsContainerContext = false;
    adapter.walkDecls(root, 'position', decl => {
      if (adapter.getValue(decl) === 'fixed') {
        needsContainerContext = true;
        return false; // stop iteration
      }
    });

    if (needsContainerContext) {
      debugUtils.stats.fixedPositionsConverted++;
      const contextRule = adapter.createRule({
        selector: conditionalSelector,
        source: adapter.getSource(root)
      });
      adapter.append(contextRule, adapter.createDecl({
        prop: 'position',
        value: 'relative',
        source: adapter.getSource(root)
      }));
      adapter.append(contextRule, adapter.createDecl({
        prop: 'contain',
        value: 'layout',
        source: adapter.getSource(root)
      }));
      adapter.prepend(root, contextRule);
      hasAddedContainerContext = true;
    }
  };

  const processRule = (rule, adapter) => {
    if (adapter.isProcessed(rule)) {
      return;
    }

    const parent = adapter.getParent(rule);
    if (parent && adapter.getType(parent) === 'atrule' &&
        [ 'media', 'container' ].includes(adapter.getName(parent))) {
      return;
    }

    const selector = adapter.getSelector(rule);
    if (
      selector.includes(conditionalNotSelector) ||
      selector.includes(containerBodySelector) ||
      selector.includes(conditionalSelector)
    ) {
      return;
    }

    // ruleProcessor.needsProcessing expects a node with walkDecls.
    // We should probably update ruleProcessor to take adapter.
    // For now, let's assume the node passed to ruleProcessor has walkDecls.
    if (ruleProcessor.needsProcessing(rule)) {
      debugUtils.stats.rulesProcessed++;
      debugUtils.log(`Processing rule: ${selector}`, rule);

      const containerRule = adapter.clone(rule, {
        selector: selectorHelper.addTargetToSelectors(selector, containerBodySelector)
      });

      adapter.setSelector(
        rule,
        selectorHelper.updateBodySelectors(selector, [ conditionalNotSelector ])
      );

      ruleProcessor.processDeclarations(containerRule, {
        isContainer: true,
        from: adapter.getFrom(rule) // adapter needs getFrom or similar
      });

      adapter.after(rule, containerRule);
      // We might need to add newlines via adapter if we care about formatting
    } else {
      adapter.setSelector(
        rule,
        selectorHelper.updateBodySelectors(
          selector,
          [ conditionalNotSelector, containerBodySelector ]
        ));
    }

    adapter.markProcessed(rule);
  };

  const processAtRule = (atRule, adapter) => {
    if (adapter.getName(atRule) !== 'media') {
      return;
    }

    debugUtils.logMediaQuery(atRule, 'START');

    if (adapter.isProcessed(atRule)) {
      debugUtils.log('Skipping already processed media query', atRule);
      return;
    }

    const parent = adapter.getParent(atRule);
    const isNested = parent && adapter.getType(parent) === 'rule';
    debugUtils.log(`Media query is ${isNested ? 'NESTED' : 'TOP-LEVEL'}`, atRule);

    let hasNotSelector = false;
    adapter.walkRules(atRule, rule => {
      if (adapter.getSelector(rule).includes(conditionalNotSelector)) {
        hasNotSelector = true;
      }
    });

    if (hasNotSelector) {
      debugUtils.log('Skipping - already has not selector', atRule);
      adapter.markProcessed(atRule);
      return;
    }

    // mediaProcessor expects an object with params.
    const conditions = mediaProcessor.getMediaConditions(atRule);
    debugUtils.log(`Extracted conditions: ${JSON.stringify(conditions)}`, atRule);

    if (conditions.length > 0) {
      debugUtils.stats.mediaQueriesProcessed++;
      const containerConditions = mediaProcessor.convertToContainerConditions(conditions);
      debugUtils.log(`Container conditions: ${containerConditions}`, atRule);

      if (containerConditions) {
        debugUtils.log('Creating container query...', atRule);

        const containerQuery = adapter.createAtRule({
          name: 'container',
          params: containerConditions,
          source: adapter.getSource(atRule)
        });

        if (isNested) {
          // Nested logic... this is the complex part.
          // We need to implement the nested logic using adapter.
          processNestedMediaQuery({
            atRule,
            containerQuery,
            parentRule: parent,
            adapter,
            unitConverter,
            debugUtils,
            selectorHelper,
            isSameMediaQuery,
            conditionalNotSelector
          });
        } else {
          adapter.walkRules(atRule, rule => {
            const containerRule = adapter.clone(rule, {
              selector: selectorHelper.updateBodySelectors(
                adapter.getSelector(rule), [ containerBodySelector ]
              )
            });

            ruleProcessor.processDeclarations(containerRule, {
              isContainer: true,
              from: adapter.getFrom(atRule)
            });

            adapter.append(containerQuery, containerRule);
          });
          adapter.after(atRule, containerQuery);
        }
      }

      if (!isNested) {
        adapter.walkRules(atRule, rule => {
          const selector = adapter.getSelector(rule);
          if (selector.includes(conditionalNotSelector)) {
            return;
          }

          const viewportRule = adapter.clone(rule);
          adapter.setSelector(
            viewportRule,
            selectorHelper.addTargetToSelectors(selector, conditionalNotSelector)
          );
          adapter.replaceWith(rule, viewportRule);
        });
      }
    } else {
      debugUtils.log('No conditions found - skipping', atRule);
    }

    adapter.markProcessed(atRule);
    debugUtils.logMediaQuery(atRule, 'END');
  };

  return {
    processRoot: (root, adapter) => addContainerContextIfNeeded(root, adapter),
    processRule,
    processAtRule,
    printSummary: () => debugUtils.printSummary()
  };
};

// Helper for nested media query logic to keep main function clean
const processNestedMediaQuery = ({
  atRule,
  containerQuery,
  parentRule,
  adapter,
  unitConverter,
  debugUtils,
  selectorHelper,
  isSameMediaQuery,
  conditionalNotSelector
}) => {
  debugUtils.log('Processing nested media query declarations...', atRule);

  adapter.each(atRule, node => {
    if (adapter.getType(node) === 'decl') {
      debugUtils.log(`  Processing declaration: ${adapter.getProp(node)}: ${adapter.getValue(node)}`, atRule);
      const containerDecl = adapter.clone(node);

      let value = adapter.getValue(containerDecl);
      if (Object.keys(unitConverter.units).some(unit => value.includes(unit))) {
        value = unitConverter.convertUnitsInExpression(value);
        adapter.setValue(containerDecl, value);
        debugUtils.log(`  Converted value to: ${value}`, atRule);
      }
      adapter.append(containerQuery, containerDecl);
    }
  });

  // ... (rest of nested logic using adapter)
  // This is very long, I will implement it fully in the file.

  // Find root nesting level
  let rootParent = parentRule;
  let isSingleLevel = true;
  while (adapter.getParent(rootParent) && adapter.getType(adapter.getParent(rootParent)) === 'rule') {
    rootParent = adapter.getParent(rootParent);
    isSingleLevel = false;
  }

  if (isSingleLevel) {
    adapter.after(atRule, containerQuery);
    const originalSelector = adapter.getSelector(parentRule);
    let conditionalRule = null;
    let alreadyHasWrapper = false;

    let prevNode = adapter.getPrev(parentRule);
    const targetSelector = selectorHelper.addTargetToSelectors(
      originalSelector,
      conditionalNotSelector
    );

    while (prevNode) {
      if (adapter.getType(prevNode) === 'rule' && adapter.getSelector(prevNode) === targetSelector) {
        conditionalRule = prevNode;
        alreadyHasWrapper = true;
        break;
      }
      prevNode = adapter.getPrev(prevNode);
    }

    if (!alreadyHasWrapper) {
      conditionalRule = adapter.createRule({
        selector: targetSelector,
        source: adapter.getSource(parentRule)
      });
      adapter.before(parentRule, conditionalRule);
    }

    const clonedMedia = adapter.clone(atRule);
    adapter.markProcessed(clonedMedia);
    adapter.append(conditionalRule, clonedMedia);
    adapter.remove(atRule);

  } else {
    // Multi-level nesting
    const rootSelector = adapter.getSelector(rootParent);
    let conditionalRule = null;
    let alreadyHasWrapper = false;

    let prevNode = adapter.getPrev(rootParent);
    const targetSelector = selectorHelper.addTargetToSelectors(
      rootSelector,
      conditionalNotSelector
    );

    while (prevNode) {
      if (adapter.getType(prevNode) === 'rule' && adapter.getSelector(prevNode) === targetSelector) {
        conditionalRule = prevNode;
        alreadyHasWrapper = true;
        break;
      }
      prevNode = adapter.getPrev(prevNode);
    }

    if (!alreadyHasWrapper) {
      conditionalRule = adapter.createRule({
        selector: targetSelector,
        source: adapter.getSource(rootParent)
      });

      adapter.each(rootParent, node => {
        const clonedNode = adapter.clone(node);

        // Remove media queries that are NOT the current one
        // This requires recursive walk or just top level check?
        // Original code used walkAtRules('media') on clonedNode.
        // Adapter needs walkAtRules.

        adapter.walkAtRules(clonedNode, 'media', (mediaRule) => {
          if (mediaRule !== atRule && !isSameMediaQuery(mediaRule, atRule, adapter)) {
            adapter.remove(mediaRule);
          } else {
            adapter.markProcessed(mediaRule);
          }
        });

        if (adapter.getType(clonedNode) === 'atrule' && adapter.getName(clonedNode) === 'media') {
          if (!isSameMediaQuery(clonedNode, atRule, adapter)) {
            return;
          }
          adapter.markProcessed(clonedNode);
        }
        adapter.append(conditionalRule, clonedNode);
      });
      adapter.before(rootParent, conditionalRule);
    } else {
      // Wrapper exists logic...
      // This part is complex: navigating the wrapper to find the matching spot.
      // I'll simplify or copy logic carefully.
      const targetInWrapper = adapter.getFirst(conditionalRule);
      if (targetInWrapper && adapter.getType(targetInWrapper) === 'rule') {
        const pathSelectors = [];
        let current = parentRule;
        while (current !== rootParent) {
          pathSelectors.unshift(adapter.getSelector(current));
          current = adapter.getParent(current);
        }

        let navNode = targetInWrapper;
        for (const selector of pathSelectors) {
          let found = false;
          adapter.each(navNode, node => {
            if (adapter.getType(node) === 'rule' && adapter.getSelector(node) === selector) {
              navNode = node;
              found = true;
              return false; // break each
            }
          });
          if (!found) {
            break;
          }
        }

        const clonedMedia = adapter.clone(atRule);
        adapter.markProcessed(clonedMedia);
        adapter.append(navNode, clonedMedia);
      }
    }
    adapter.remove(atRule);
    adapter.append(parentRule, containerQuery);
  }
};

module.exports = createCoreProcessor;

/**
 * PostCSS plugin to toggle viewport units into container query units.
 *
 * This plugin processes CSS rules and media queries to add container query versions
 * alongside the existing viewport versions. It includes support for:
 * - Converting `position: fixed` to `position: sticky` in container contexts.
 * - Handling nested media queries.
 * - Adding container query contexts when required.
 *
 * @param {Object} opts - Plugin options.
 * @param {Object} [opts.units] - A mapping of viewport units to container query units.
 * @param {string} [opts.containerEl='body'] - The container element selector.
 * @param {string} [opts.modifierAttr='data-breakpoint-preview-mode']
 * - The attribute for container queries.
 * @param {Function} [opts.transform] - A custom function to transform
 * media queries when creating container queries.
 * @param {boolean} [opts.debug=false] - Enables debug logging.
 * @param {string} [opts.debugFilter] - A filter string for limiting debug
 * logs to specific files.
 * @returns {Object} The PostCSS plugin.
 */
const { DEFAULT_OPTIONS } = require('./src/constants/defaults');
const createUnitConverter = require('./src/utils/unitConverter');
const createMediaProcessor = require('./src/utils/mediaProcessor');
const createRuleProcessor = require('./src/utils/ruleProcessor');
const createDebugUtils = require('./src/utils/debug');
const createSelectorHelper = require('./src/utils/selectorHelper');

const plugin = (opts = {}) => {
  // Merge options with defaults
  const options = {
    ...DEFAULT_OPTIONS,
    ...opts
  };
  const { containerEl, modifierAttr } = options;

  // Create selectors
  const conditionalSelector = `${containerEl}[${modifierAttr}]`;
  const conditionalNotSelector = `${containerEl}:not([${modifierAttr}])`;
  const containerBodySelector = '[data-apos-refreshable-body]';

  // Create utility instances
  const unitConverter = createUnitConverter({ units: options.units });
  const debugUtils = createDebugUtils(options);
  const mediaProcessor = createMediaProcessor({
    ...options
  });
  const ruleProcessor = createRuleProcessor({
    ...options,
    unitConverter
  });
  const selectorHelper = createSelectorHelper({ modifierAttr });

  // Track processed nodes to avoid duplicates
  const processed = Symbol('processed');

  // Flag to track if container context like sticky has been added
  let hasAddedContainerContext = false;

  const isSameMediaQuery = (mq1, mq2) => {
    return mq1.params === mq2.params &&
      mq1.source?.start?.line === mq2.source?.start?.line;
  };

  /**
 * Adds a container context with `position: relative` and `contain: layout` if required.
 *
 * @param {Object} root - The PostCSS root node.
 * @param {Object} helpers - PostCSS helpers, including the `Rule` constructor.
 */
  const addContainerContextIfNeeded = (root, helpers) => {
    if (hasAddedContainerContext) {
      return;
    }

    let needsContainerContext = false;
    root.walkDecls('position', decl => {
      if (decl.value === 'fixed') {
        needsContainerContext = true;
        return false;
      }
    });

    if (needsContainerContext) {
      debugUtils.stats.fixedPositionsConverted++;
      const contextRule = new helpers.Rule({
        selector: conditionalSelector,
        source: root.source,
        from: helpers.result.opts.from
      });
      contextRule.append({
        prop: 'position',
        value: 'relative',
        source: root.source,
        from: helpers.result.opts.from
      });
      contextRule.append({
        prop: 'contain',
        value: 'layout',
        source: root.source,
        from: helpers.result.opts.from
      });
      root.prepend(contextRule);
      hasAddedContainerContext = true;
    }
  };

  return {
    postcssPlugin: 'postcss-viewport-to-container-toggle',

    Once(root, helpers) {
      addContainerContextIfNeeded(root, helpers);
    },

    Rule(rule, helpers) {
      // Skip already processed rules
      if (rule[processed]) {
        return;
      }

      // Skip rules inside media queries - these will be handled by AtRule
      // as well as the ones inside container queries (already processed or from css)
      if (
        rule.parent?.type === 'atrule' &&
        [ 'media', 'container' ].includes(rule.parent?.name)
      ) {
        return;
      }

      // Do not treat cloned rules already handled
      if (
        rule.selector.includes(conditionalNotSelector) ||
        rule.selector.includes(containerBodySelector) ||
        rule.selector.includes(conditionalSelector)
      ) {
        return;
      }

      // Process rule if it needs conversion
      if (ruleProcessor.needsProcessing(rule)) {
        debugUtils.stats.rulesProcessed++;
        debugUtils.log(`Processing rule: ${rule.selector}`, rule);

        // Create container version with converted units
        // should target [data-apos-refreshable-body]
        const containerRule = rule.clone({
          source: rule.source,
          from: helpers.result.opts.from,
          selector: selectorHelper.addTargetToSelectors(
            rule.selector,
            containerBodySelector
          )
        });

        rule.selector = selectorHelper.updateBodySelectors(
          rule.selector,
          [ conditionalNotSelector ]
        );

        ruleProcessor.processDeclarations(containerRule, {
          isContainer: true,
          from: helpers.result.opts.from
        });

        // Add container rule after original
        rule.after('\n' + containerRule);
      } else {
        rule.selector = selectorHelper.updateBodySelectors(
          rule.selector,
          [ conditionalNotSelector, containerBodySelector ]
        );
      }

      rule[processed] = true;
    },

    AtRule: {
      media(atRule, helpers) {
        debugUtils.logMediaQuery(atRule, 'START');

        if (atRule[processed]) {
          debugUtils.log('Skipping already processed media query', atRule);
          return;
        }

        // Check if this media query is nested inside a rule
        const isNested = atRule.parent?.type === 'rule';
        debugUtils.log(`Media query is ${isNested ? 'NESTED' : 'TOP-LEVEL'}`, atRule);

        let hasNotSelector = false;
        atRule.walkRules(rule => {
          if (rule.selector.includes(conditionalNotSelector)) {
            hasNotSelector = true;
          }
        });

        if (hasNotSelector) {
          debugUtils.log('Skipping - already has not selector', atRule);
          atRule[processed] = true;
          return;
        }

        const conditions = mediaProcessor.getMediaConditions(atRule);
        debugUtils.log(`Extracted conditions: ${JSON.stringify(conditions)}`, atRule);

        if (conditions.length > 0) {
          debugUtils.stats.mediaQueriesProcessed++;

          const containerConditions =
            mediaProcessor.convertToContainerConditions(conditions);

          debugUtils.log(`Container conditions: ${containerConditions}`, atRule);

          if (containerConditions) {
            debugUtils.log('Creating container query...', atRule);

            const containerQuery = new helpers.AtRule({
              name: 'container',
              params: containerConditions,
              source: atRule.source,
              from: helpers.result.opts.from
            });

            // For nested media queries
            if (isNested) {
              debugUtils.log('Processing nested media query declarations...', atRule);

              atRule.each(node => {
                if (node.type === 'decl') {
                  debugUtils.log(`  Processing declaration: ${node.prop}: ${node.value}`, atRule);

                  const containerDecl = node.clone({
                    source: node.source,
                    from: helpers.result.opts.from
                  });

                  // Convert viewport units if needed
                  let value = containerDecl.value;
                  if (Object.keys(unitConverter.units)
                    .some(unit => value.includes(unit))) {
                    value = unitConverter.convertUnitsInExpression(value);
                    containerDecl.value = value;
                    debugUtils.log(`  Converted value to: ${value}`, atRule);
                  }

                  containerQuery.append(containerDecl);
                }
              });

              debugUtils.log(`  Total declarations in container query: ${containerQuery.nodes?.length || 0}`, atRule);

              const parentRule = atRule.parent;

              // Find the root nesting level
              let rootParent = parentRule;
              let isSingleLevel = true;
              while (rootParent.parent && rootParent.parent.type === 'rule') {
                rootParent = rootParent.parent;
                isSingleLevel = false;
              }

              // For single-level nesting (Tailwind case), use simple approach
              if (isSingleLevel) {
                // Add container query inside the parent rule, after the media query
                atRule.after(containerQuery);

                const originalSelector = parentRule.selector;

                let conditionalRule = null;
                let alreadyHasWrapper = false;

                let prevNode = parentRule.prev();
                const targetSelector = selectorHelper
                  .addTargetToSelectors(
                    originalSelector,
                    conditionalNotSelector
                  );

                while (prevNode) {
                  if (prevNode.type === 'rule' && prevNode.selector === targetSelector) {
                    conditionalRule = prevNode;
                    alreadyHasWrapper = true;
                    debugUtils.log('Found existing conditional wrapper, reusing it', atRule);
                    break;
                  }
                  prevNode = prevNode.prev();
                }

                if (!alreadyHasWrapper) {
                  conditionalRule = new helpers.Rule({
                    selector: targetSelector,
                    source: parentRule.source,
                    from: helpers.result.opts.from
                  });

                  parentRule.before(conditionalRule);
                  debugUtils.log('Created new conditional wrapper', atRule);
                }

                const clonedMedia = atRule.clone();
                clonedMedia[processed] = true;
                conditionalRule.append(clonedMedia);
                atRule.remove();

                debugUtils.log('Added conditional wrapper for nested media query', atRule);

              } else {
                // Multi-level nesting - hoist to root with full structure
                const rootSelector = rootParent.selector;

                // Check if wrapper exists at root level
                let conditionalRule = null;
                let alreadyHasWrapper = false;

                let prevNode = rootParent.prev();
                const targetSelector = selectorHelper
                  .addTargetToSelectors(
                    rootSelector,
                    conditionalNotSelector
                  );

                while (prevNode) {
                  if (prevNode.type === 'rule' && prevNode.selector === targetSelector) {
                    conditionalRule = prevNode;
                    alreadyHasWrapper = true;
                    debugUtils.log('Found existing conditional wrapper, reusing it', atRule);
                    break;
                  }
                  prevNode = prevNode.prev();
                }

                if (!alreadyHasWrapper) {
                  // Create wrapper with full nested structure
                  conditionalRule = new helpers.Rule({
                    selector: targetSelector,
                    source: rootParent.source,
                    from: helpers.result.opts.from
                  });

                  // Clone children of root parent (before container query is added)
                  rootParent.each(node => {
                    const clonedNode = node.clone();

                    // Remove media queries that are NOT the current one being processed
                    clonedNode.walkAtRules('media', (mediaRule) => {
                      // Keep the current media query we're processing, remove others
                      if (mediaRule !== atRule && !isSameMediaQuery(mediaRule, atRule)) {
                        mediaRule.remove();
                      } else {
                        mediaRule[processed] = true;
                      }
                    });

                    // If this node itself is a media query
                    // and not the one we're processing, skip it
                    if (clonedNode.type === 'atrule' && clonedNode.name === 'media') {
                      if (!isSameMediaQuery(clonedNode, atRule)) {
                        return; // Skip appending
                      }
                      clonedNode[processed] = true;
                    }

                    conditionalRule.append(clonedNode);
                  });

                  rootParent.before(conditionalRule);
                  debugUtils.log('Created new conditional wrapper at root level', atRule);
                } else {
                  // Wrapper exists, add media query to matching nested location
                  const targetInWrapper = conditionalRule.first;
                  if (targetInWrapper && targetInWrapper.type === 'rule') {
                    // Build path from parentRule to rootParent
                    const pathSelectors = [];
                    let current = parentRule;
                    while (current !== rootParent) {
                      pathSelectors.unshift(current.selector);
                      current = current.parent;
                    }

                    // Navigate to matching location in wrapper
                    let navNode = targetInWrapper;
                    for (const selector of pathSelectors) {
                      let found = false;
                      navNode.each(node => {
                        if (node.type === 'rule' && node.selector === selector) {
                          navNode = node;
                          found = true;
                          return false;
                        }
                      });
                      if (!found) {
                        break;
                      }
                    }

                    // Add cloned media to correct location
                    const clonedMedia = atRule.clone();
                    clonedMedia[processed] = true;
                    navNode.append(clonedMedia);
                  }
                }

                // Remove from original
                atRule.remove();

                // Now add container query to original (after cloning)
                parentRule.append(containerQuery);

                debugUtils.log('Added conditional wrapper for nested media query', atRule);
              }

            } else {
              // Original logic for top-level media queries
              atRule.walkRules(rule => {
                const containerRule = rule.clone({
                  source: rule.source,
                  from: helpers.result.opts.from,
                  selector: selectorHelper.updateBodySelectors(
                    rule.selector,
                    [ containerBodySelector ]
                  )
                });

                ruleProcessor.processDeclarations(containerRule, {
                  isContainer: true,
                  from: helpers.result.opts.from
                });

                containerRule.raws.before = '\n  ';
                containerRule.raws.after = '\n  ';
                containerRule.walkDecls(decl => {
                  decl.raws.before = '\n    ';
                });

                containerQuery.append(containerRule);
              });

              // Add container query
              atRule.after(containerQuery);
            }
          }

          // Now handle viewport media query modifications
          // We want the original media query to get the not selector
          if (!isNested) {
            atRule.walkRules(rule => {
              // Skip if already modified with not selector
              if (rule.selector.includes(conditionalNotSelector)) {
                return;
              }

              const viewportRule = rule.clone({
                source: rule.source,
                from: helpers.result.opts.from
              });

              viewportRule.selector = selectorHelper.addTargetToSelectors(
                rule.selector,
                conditionalNotSelector
              );

              rule.replaceWith(viewportRule);
            });
          }
        } else {
          debugUtils.log('No conditions found - skipping', atRule);
        }

        // Only mark the atRule as processed after all transformations
        atRule[processed] = true;
        debugUtils.logMediaQuery(atRule, 'END');
      }
    },

    OnceExit() {
      debugUtils.printSummary();
    }
  };
};

plugin.postcss = true;

module.exports = plugin;

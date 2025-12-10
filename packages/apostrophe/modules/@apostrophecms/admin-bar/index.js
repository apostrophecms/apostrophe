// The admin bar module implements Apostrophe's admin bar at the top of the
// screen. Any module can register a button (or more than one) for this bar by
// calling the `add` method of this module. Buttons can also be grouped into
// dropdown menus and restricted to those with particular permissions.
// [@apostrophecms/piece-type](../@apostrophecms/piece-type/index.html)
// automatically takes advantage of this module.

const _ = require('lodash');
const { createId } = require('@paralleldrive/cuid2');

module.exports = {
  options: {
    alias: 'adminBar',
    // Do include a page tree button in the admin bar
    pageTree: true
  },
  commands(self) {
    const breakpointPreviewModeScreens = (
      self.apos.asset.options.breakpointPreviewMode?.enable &&
      self.apos.asset.options.breakpointPreviewMode?.screens
    ) || {};
    const breakpointPreviewModeCommands = {
      [`${self.__meta.name}:toggle-breakpoint-preview-mode:exit`]: {
        type: 'item',
        label: {
          key: 'apostrophe:commandMenuToggleBreakpointPreviewMode',
          breakpoint: '$t(apostrophe:breakpointPreviewExit)'
        },
        action: {
          type: 'command-menu-admin-bar-toggle-breakpoint-preview-mode',
          payload: {
            mode: null,
            width: null,
            height: null
          }
        },
        shortcut: 'P,0'
      }
    };
    let index = 1;
    for (const [ name, screen ] of Object.entries(breakpointPreviewModeScreens)) {
      // Up to 9 shortcuts available
      if (index === 9) {
        break;
      }
      if (!screen.shortcut) {
        continue;
      }

      breakpointPreviewModeCommands[`${self.__meta.name}:toggle-breakpoint-preview-mode:${name}`] = {
        type: 'item',
        label: {
          key: 'apostrophe:commandMenuToggleBreakpointPreviewMode',
          breakpoint: `$t(${screen.label})`
        },
        action: {
          type: 'command-menu-admin-bar-toggle-breakpoint-preview-mode',
          payload: {
            mode: name,
            label: `$t(${screen.label})`,
            width: screen.width,
            height: screen.height
          }
        },
        shortcut: `P,${index}`
      };

      index += 1;
    };

    return {
      add: {
        [`${self.__meta.name}:undo`]: {
          type: 'item',
          label: 'apostrophe:commandMenuUndo',
          action: {
            type: 'command-menu-admin-bar-undo'
          },
          shortcut: 'Ctrl+Z Meta+Z'
        },
        [`${self.__meta.name}:redo`]: {
          type: 'item',
          label: 'apostrophe:commandMenuRedo',
          action: {
            type: 'command-menu-admin-bar-redo'
          },
          shortcut: 'Ctrl+Shift+Z Meta+Shift+Z'
        },
        [`${self.__meta.name}:discard-draft`]: {
          type: 'item',
          label: 'apostrophe:commandMenuDiscardDraft',
          action: {
            type: 'command-menu-admin-bar-discard-draft'
          },
          shortcut: 'Ctrl+Shift+Backspace Meta+Shift+Backspace'
        },
        [`${self.__meta.name}:publish-draft`]: {
          type: 'item',
          label: 'apostrophe:commandMenuPublishDraft',
          action: {
            type: 'command-menu-admin-bar-publish-draft'
          },
          shortcut: 'Ctrl+Shift+P Meta+Shift+P'
        },
        [`${self.__meta.name}:toggle-edit-preview-mode`]: {
          type: 'item',
          label: 'apostrophe:commandMenuToggleEditPreviewMode',
          action: {
            type: 'command-menu-admin-bar-toggle-edit-preview'
          },
          shortcut: 'Ctrl+/ Meta+/'
        },
        [`${self.__meta.name}:toggle-published-draft-document`]: {
          type: 'item',
          label: 'apostrophe:commandMenuTogglePublishedDraftDocument',
          action: {
            type: 'command-menu-admin-bar-toggle-publish-draft'
          },
          shortcut: 'Ctrl+Shift+M Meta+Shift+M'
        },
        ...breakpointPreviewModeCommands
      },
      modal: {
        default: {
          '@apostrophecms/command-menu:content': {
            label: 'apostrophe:commandMenuContent',
            commands: [
              `${self.__meta.name}:undo`,
              `${self.__meta.name}:redo`,
              `${self.__meta.name}:discard-draft`,
              `${self.__meta.name}:publish-draft`
            ]
          },
          '@apostrophecms/command-menu:mode': {
            label: 'apostrophe:commandMenuMode',
            commands: [
              `${self.__meta.name}:toggle-edit-preview-mode`,
              `${self.__meta.name}:toggle-published-draft-document`,
              ...Object.keys(breakpointPreviewModeCommands)
            ]
          }
        }
      }
    };
  },
  init(self) {
    self.items = [];
    self.groups = [];
    self.groupLabels = {};
    self.bars = [];
    self.contextLabels = [];
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        orderAndGroupItems() {
          self.orderItems();
          self.groupItems();
        }
      }
    };
  },
  methods(self) {
    return {
      // Add an item to the admin bar.
      //
      // When the item is activated, the `name` argument will be emitted on
      // `apos.bus` as the value of an `admin-menu-click` event. The
      // `TheAposModals` app will typically catch this and respond by
      // displaying the appropriate modal. So `name` should
      // be the module name, with `:editor` or `:manager` suffix, depending
      // on the case, such as `@apostrophecms/global:editor` or
      // `@apostrophecms/page:manager`.
      //
      // TODO: Alternatively, an `href` option may be set to an ordinary
      // URL in `options`. This creates a basic link in the admin menu.
      //
      // `permission` should be an object with `action` and `type`
      // properties. This determines visibility of the option, securing
      // actual actions is a separate concern.
      //
      // You can use the `after` option to specify an admin bar item name
      // this item should appear immediately following.
      //
      // Usually just one admin bar item per module makes sense.
      //
      // On the browser side, it is possible to write
      // `apos.bus.$on('admin-menu-click', (name) => { ... })` to catch
      // these events and respond. You can use this mechanism if you
      // wish to implement a custom admin bar item not powered by
      // the `AposModals` app.
      //
      // If `options.contextUtility` is true, the item will be displayed in a
      // tray of icons just to the right of the login and/or locales menu. If
      // `options.toggle` is also true, then the button will have the `active`
      // state until toggled off again. `options.tooltip.deactivate` and
      // `options.tooltip.activate` may be provided to offer a different tooltip
      // during the active versus inactive states, respectively. Otherwise,
      // `options.tooltip` is used. The regular label is also present for
      // screenreaders only. The contextUtility functionality is typically used
      // for experiences that temporarily change the current editing context.
      //
      // If `options.user` is true, the menu bar item will appear
      // on the user's personal dropdown, where "Log Out" appears. Such items
      // cannot be grouped further.

      // If an `options.when` function is provided, it will be invoked with
      // `req` to test whether this admin bar item should be displayed or not.

      add(name, label, permission, options) {
        let index;

        const item = {
          name: name.indexOf(':') === -1 ? name : name.split(':')[0],
          action: name,
          label,
          permission,
          options: options || {}
        };
        if (options && options.after) {
          index = _.findIndex(self.items, { name: options.after });
          if (index !== -1) {
            self.items.splice(index + 1, 0, item);
            return;
          }
        }
        self.items.push(item);
      },

      getVisibleItems(req) {
        // Find the subset of admin bar items this user is permitted to see
        const user = req.user;
        if (!user) {
          return [];
        }
        const items = _.filter(self.items, function (item) {
          return self.itemIsVisible(req, item);
        });
        if (!items.length) {
          return [];
        }
        // Find the combined items and group them up into menus.
        // groupedItems becomes an array that mixes standalone
        // admin bar items with menus.
        const groupedItems = [];
        let menu = false;
        items.forEach(function (item, i) {
          if (menu) {
            // We are already building up a grouped menu, but stop doing that
            // if this next item isn't part of it
            if (item.menuLeader === menu.leader.name) {
              menu.items.push(item);
              return;
            } else {
              menu = false;
            }
          }
          // Only build a menu if there are at least two items after filtering
          // for permissions
          if (
            item.menuLeader === item.name &&
            items[i + 1]?.menuLeader === item.name
          ) {
            menu = {
              menu: true,
              items: [ item ],
              leader: item,
              label: self.groupLabels[item.name] || item.label
            };
            groupedItems.push(menu);
          } else {
            groupedItems.push(item);
          }
        });
        return groupedItems;
      },

      // Implement the `order` option. This insertion sort results
      // in putting everything otherwise unspecified at the end, as desired.
      // Items with the `last: true` option are moved to the end before the
      // explicit order is applied.
      //
      // Called by `afterInit`

      orderItems() {
        const ordered = [];
        const unordered = [];
        const last = [];

        // Separate items into categories
        self.items.forEach(item => {
          if (!(self.options.order || []).includes(item.name)) {
            if (item.options.last) {
              last.push(item);
            } else {
              unordered.push(item);
            }
          }
        });

        // Build ordered array in the sequence specified by options.order
        (self.options.order || []).forEach(name => {
          const item = self.items.find(item => item.name === name);
          if (item) {
            ordered.push(item);
          }
        });

        self.items = ordered.concat(unordered).concat(last);
      },

      // Marks items that have been grouped via the `groups` option — or via
      // `group` calls from modules, combined with the `addGroups` option —
      // with a `menuLeader` property and ensures that the items in a group
      // are consecutive in the order. We'll figure out the final menus at
      // render time so we can handle it properly if an individual
      // user only sees one of them, etc. Called by `afterInit`

      // Fixed groupItems method that respects group registration order

      groupItems() {
        const groups = self.options.groups ||
          self.groups.concat(self.options.addGroups || []);

        // Track which items have been grouped to detect duplicates
        const groupedItems = new Map(); // itemName -> groupLabel

        // If we have an explicit order
        // use the existing logic with duplicate detection
        if (self.options.order && self.options.order.length > 0) {
          groups.forEach(function (group) {
            if (!group.label) {
              return;
            }

            self.groupLabels[group.items[0]] = group.label;

            group.items.forEach(function (name, groupIndex) {
              // Check for duplicates
              if (groupedItems.has(name)) {
                self.apos.util.warn(
                  `Admin bar item "${name}" appears in multiple groups: "${groupedItems.get(name)}" and "${group.label}". ` +
                  `Using first occurrence in "${groupedItems.get(name)}".`
                );
                return; // Skip this item in the current group
              }

              const item = _.find(self.items, { name });
              if (item) {
                item.menuLeader = group.items[0];
                groupedItems.set(name, group.label);
              } else {
                return;
              }

              // Make sure the submenu items wind up following the leader
              // in self.items in the appropriate order
              if (name !== item.menuLeader) {
                const indexLeader = _.findIndex(self.items, { name: item.menuLeader });
                if (indexLeader === -1) {
                  throw new Error('Admin bar grouping error: no match for ' + item.menuLeader + ' in menu item ' + item.name);
                }
                let indexMe = _.findIndex(self.items, { name });
                if (indexMe !== indexLeader + groupIndex) {
                  // Swap ourselves into the right position following our leader
                  if (indexLeader + groupIndex < indexMe) {
                    indexMe++;
                  }
                  self.items.splice(indexLeader + groupIndex, 0, item);
                  self.items.splice(indexMe, 1);
                }
              }
            });
          });
          return;
        }
        // No explicit order - respect group registration order
        const newItems = [];
        const processedItems = new Set();

        // First, process all groups in registration order
        groups.forEach(function (group) {
          if (!group.label) {
            return;
          }

          // Collect valid items for this group (excluding duplicates and missing items)
          const validGroupItems = [];

          group.items.forEach(function (name) {
            // Check for duplicates
            if (groupedItems.has(name)) {
              self.apos.util.warn(
                `Admin bar item "${name}" appears in multiple groups: "${groupedItems.get(name)}" and "${group.label}". ` +
                `Using first occurrence in "${groupedItems.get(name)}".`
              );
              return;
            }

            const item = _.find(self.items, { name });
            if (item && !processedItems.has(name)) {
              validGroupItems.push({
                item,
                name
              });
            }
          });

          // Only create a group if there are multiple valid items
          if (validGroupItems.length > 1) {
            const leaderName = validGroupItems[0].name;
            self.groupLabels[leaderName] = group.label;

            validGroupItems.forEach(({ item, name }) => {
              item.menuLeader = leaderName;
              newItems.push(item);
              processedItems.add(name);
              groupedItems.set(name, group.label);
            });
          } else if (validGroupItems.length === 1) {
            // Single item - add without grouping
            const { item, name } = validGroupItems[0];
            newItems.push(item);
            processedItems.add(name);
          }
        });

        // Then add any remaining ungrouped items in their original order
        self.items.forEach(function (item) {
          if (!processedItems.has(item.name)) {
            newItems.push(item);
            processedItems.add(item.name);
          }
        });

        self.items = newItems;
      },

      // Determine if the specified admin bar item object should
      // be rendered or not, for the given req; based on item.permission
      // if any. `req.user` is guaranteed to exist at this point.

      itemIsVisible(req, item) {
        if (!item.permission) {
          // Being logged in is good enough to see this
          return true;
        }
        // Test the permission as if we were in draft mode, as when you actually
        // manage the items those requests will be made in draft mode (when
        // applicable to the content type)
        return self.apos.permission.can(req, item.permission.action, item.permission.type, 'draft');
      },

      // Show admin bar for logged-in user only

      getShowAdminBar(req) {
        return !!req.user;
      },

      getBrowserData(req) {
        if (!req.user) {
          return false;
        }
        const items = self.getVisibleItems(req);
        const context = req.data.piece || req.data.page;
        // Page caching is never desirable when possibly
        // editing that page
        if (context && context._edit) {
          req.res.setHeader('Cache-Control', 'no-cache');
        }
        let contextEditorName;
        if (context) {
          if (self.apos.page.isPage(context)) {
            contextEditorName = '@apostrophecms/page:editor';
          } else {
            contextEditorName = `${context.type}:editor`;
          }
        }
        return {
          items,
          components: { the: 'TheAposAdminBar' },
          context: context && {
            _id: context._id,
            title: context.title,
            type: context.type,
            _url: context._url,
            slug: context.slug,
            modified: context.modified,
            updatedAt: context.updatedAt,
            updatedBy: context.updatedBy,
            submitted: context.submitted,
            lastPublishedAt: context.lastPublishedAt,
            _edit: context._edit,
            _publish: context._publish,
            aposMode: context.aposMode,
            aposLocale: context.aposLocale,
            aposDocId: context.aposDocId
          },
          breakpointPreviewMode: self.apos.asset.options.breakpointPreviewMode ||
          {
            enable: false,
            debug: false,
            resizable: false,
            screens: {}
          },
          // Base API URL appropriate to the context document
          contextBar: context && self.apos.doc
            .getManager(context.type).options.contextBar,
          showAdminBar: self.getShowAdminBar(req),
          // Simplifies frontend logic
          contextId: context && context._id,
          tabId: createId(),
          contextEditorName,
          pageTree: self.options.pageTree && self.apos.permission.can(req, 'edit', '@apostrophecms/any-page-type', 'draft'),
          bars: self.bars,
          contextLabels: self.contextLabels
        };
      },

      // Add custom bars and place the ones
      // that have `last: true` at the end
      // of the list so that they will be
      // displayed below the others.
      //
      // Example:
      //
      // ```js
      // self.addBar({
      //   id: 'template',
      //   componentName: 'TheAposTemplateBar',
      //   props: { content: 'Some content' },
      //   last: true
      // });
      // ```
      addBar(bar) {
        self.bars.push(bar);

        self.bars.sort((a, b) => {
          if (a.last === true && b.last === true) {
            return 0;
          }
          return b.last === true ? -1 : 1;
        });
      },

      // Add custom context labels and place the ones
      // that have `last: true` at the end
      // of the list so that they will be
      // displayed after the others.
      //
      // Example:
      //
      // ```js
      // self.addContextLabel({
      //   id: 'myLabel'
      //   label: 'apos:myLabel',
      //   tooltip: 'apos:myTooltip',
      //   last: true,
      //   modifiers: ['apos-is-warning', 'apos-is-filled']
      // });
      // ```
      addContextLabel(label) {
        self.contextLabels.push(label);

        self.contextLabels.sort((a, b) => {
          if (a.last === true && b.last === true) {
            return 0;
          }
          return b.last === true ? -1 : 1;
        });
      }
    };
  },
  tasks(self) {
    return {
      inspect: {
        usage: 'Inspect and list all registered admin bar items and groups',
        ready: true,

        async task(apos, argv) {

          const allGroups = [
            ...self.groups,
            ...(self.options.addGroups || []),
            ...(self.options.groups || [])
          ];
          console.log('\n🔍 APOSTROPHE ADMIN BAR INSPECTION\n');
          console.log('=' + '='.repeat(50));

          // Display configuration overview
          console.log('\n📋 CONFIGURATION OVERVIEW');
          console.log('-'.repeat(30));
          console.log(`Page Tree Enabled: ${self.options.pageTree ? '✅' : '❌'}`);
          if (self.options.order) {
            console.log(`Order: [${self.options.order.join(', ')}]`);
          }

          console.log(`Total Items Registered: ${self.items.length}`);
          console.log(`Total Groups Registered: ${allGroups.length}`);

          console.log(`Custom Order Defined: ${self.options.order ? '✅' : '❌'}`);
          console.log(`Custom Bars: ${self.bars.length}`);

          // Display all registered items
          console.log('\n📝 REGISTERED ITEMS');
          console.log('-'.repeat(30));

          if (self.items.length === 0) {
            console.log('No items registered');
          } else {
            self.items.forEach((item, index) => {
              console.log(`\n${index + 1}. ${item.name}`);
              console.log(`   Action: ${item.action}`);
              console.log(`   Label: ${item.label}`);

              if (item.menuLeader) {
                const groupLabel = self.groupLabels[item.menuLeader];
                if (groupLabel) {
                  console.log(`   Group: "${groupLabel}" (leader: ${item.menuLeader})`);
                } else {
                  console.log(`   Group Leader: ${item.menuLeader}`);
                }
              }

              if (item.options && Object.keys(item.options).length > 0) {
                console.log('   Options:');
                Object.entries(item.options).forEach(([ key, value ]) => {
                  console.log(`     ${key}: ${JSON.stringify(value)}`);
                });
              }
            });
          }

          // Display registered groups
          console.log('\n👥 REGISTERED GROUPS');
          console.log('-'.repeat(30));

          if (allGroups.length === 0) {
            console.log('No groups registered');
          } else {
            allGroups.forEach((group, index) => {
              console.log(`\n${index + 1}. Group: "${group.label || 'Unnamed'}"`);
              console.log(`   Items: [${group.items.join(', ')}]`);

              // Show which items actually exist
              const existingItems = group.items.filter(itemName =>
                self.items.some(item => item.name === itemName)
              );
              const missingItems = group.items.filter(itemName =>
                !self.items.some(item => item.name === itemName)
              );

              if (existingItems.length > 0) {
                console.log(`   ✅ Existing: [${existingItems.join(', ')}]`);
              }
              if (missingItems.length > 0) {
                console.log(`   ❌ Missing: [${missingItems.join(', ')}]`);
              }
            });
          }

          // Display custom bars
          if (self.bars.length > 0) {
            console.log('\n📊 CUSTOM BARS');
            console.log('-'.repeat(30));

            self.bars.forEach((bar, index) => {
              console.log(`\n${index + 1}. ${bar.id}`);
              console.log(`   Component: ${bar.componentName}`);
              console.log(`   Last: ${bar.last ? '✅' : '❌'}`);
              if (bar.props) {
                console.log(`   Props: ${JSON.stringify(bar.props, null, 2)}`);
              }
            });
          }
          console.log('\n✨ Inspection complete!\n');
        }
      }
    };
  }
};

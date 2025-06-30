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
    for (const [name, screen] of Object.entries(breakpointPreviewModeScreens)) {
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
              items: [item],
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

      groupItems() {
        const groups = self.options.groups ||
          self.groups.concat(self.options.addGroups || []);

        // Track which items have been claimed and in what role
        const itemRoles = new Map();
        const conflicts = [];

        // First pass: detect conflicts
        groups.forEach(function (group, groupIndex) {
          if (!group.label || !group.items || group.items.length === 0) {
            return;
          }

          const leaderName = group.items[0];

          group.items.forEach(function (itemName, itemIndex) {
            const role = itemIndex === 0 ? 'leader' : 'member';

            if (itemRoles.has(itemName)) {
              const existing = itemRoles.get(itemName);
              conflicts.push({
                itemName,
                existing: existing,
                new: { groupLabel: group.label, role, groupIndex }
              });
            } else {
              itemRoles.set(itemName, {
                groupLabel: group.label,
                role,
                groupIndex,
                leaderName
              });
            }
          });
        });

        // Report conflicts with helpful warnings
        if (conflicts.length > 0) {
          self.apos.util.warn('Admin bar group conflicts detected:');
          conflicts.forEach(conflict => {
            const { itemName, existing, new: newRole } = conflict;
            self.apos.util.warn(
              `  - "${itemName}" is ${existing.role} of "${existing.groupLabel}" ` +
              `but also ${newRole.role} of "${newRole.groupLabel}". ` +
              `Using first definition (${existing.role} of "${existing.groupLabel}").`
            );
          });
        }

        // Second pass: apply grouping using first-wins rule
        groups.forEach(function (group, groupIndex) {
          if (!group.label || !group.items || group.items.length === 0) {
            return;
          }

          const leaderName = group.items[0];

          // Set the group label
          self.groupLabels[leaderName] = group.label;

          // Mark all group items with their leader (first-wins rule)
          group.items.forEach(function (name) {
            const item = self.items.find(item => item.name === name);
            if (item && !item.menuLeader) {  // Only set if not already claimed
              item.menuLeader = leaderName;
            }
          });

          // Find the leader's current position
          const leaderIndex = self.items.findIndex(item => item.name === leaderName);
          if (leaderIndex === -1) return;

          // Collect all group members that weren't claimed by earlier groups
          const groupMembers = [];
          group.items.forEach(function (name) {
            const item = self.items.find(item => item.name === name);
            if (item && item.menuLeader === leaderName) {  // Only include if this group owns it
              groupMembers.push(item);
            }
          });

          if (groupMembers.length === 0) return;

          // Remove all group members from current positions
          self.items = self.items.filter(item =>
            !groupMembers.some(member => member.name === item.name)
          );

          // Re-insert all group members together at the leader's original position
          self.items.splice(leaderIndex, 0, ...groupMembers);
        });
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
  }
};

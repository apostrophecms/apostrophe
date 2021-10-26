// The admin bar module implements Apostrophe's admin bar at the top of the screen. Any module
// can register a button (or more than one) for this bar by calling the `add` method of this
// module. Buttons can also be grouped into dropdown menus and restricted to those with
// particular permissions. [@apostrophecms/piece-type](../@apostrophecms/piece-type/index.html) automatically
// takes advantage of this module.

const _ = require('lodash');
const cuid = require('cuid');

module.exports = {
  options: {
    alias: 'adminBar',
    // Do include a page tree button in the admin bar
    pageTree: true
  },
  init(self) {
    self.items = [];
    self.groups = [];
    self.groupLabels = {};
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
      // Alternatively, an `href` option may be set to an ordinary URL in
      // `options`. This creates a basic link in the admin menu.
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
      // If `options.contextUtility` is true the item will be displayed in a tray of
      // icons just to the left of the page settings gear. If `options.toggle` is also true,
      // then the button will have the `active` state until toggled
      // off again. `options.openTooltip` and `options.closeTooltip` may be
      // provided to offer a different tooltip during the active state. Otherwise
      // `options.tooltip` is used. The regular label is also present for
      // screenreaders only. The contextUtility functionality is typically used for
      // experiences that temporarily change the current editing context.
      //
      // If an `options.when` function is provided, it will be invoked with
      // `req` to test whether this admin bar item should be displayed or not.

      add(name, label, permission, options) {
        let index;

        const item = {
          name: name.indexOf(':') === -1 ? name : name.split(':')[0],
          action: name,
          label: label,
          permission: permission,
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
          if (item.menuLeader === item.name && (items[i + 1] && items[i + 1].menuLeader === item.name)) {
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
        // Items with a preference to go last go last...
        const moving = [];
        while (true) {
          const moveIndex = _.findIndex(self.items, function (item) {
            return item.options.last;
          });
          if (moveIndex === -1) {
            break;
          }
          moving.push(self.items[moveIndex]);
          self.items.splice(moveIndex, 1);
        }
        self.items = self.items.concat(moving);
        // ... But then explicit order kicks in
        _.each(self.options.order || [], function (name) {
          const item = _.find(self.items, { name: name });
          if (item) {
            self.items = [ item ].concat(_.filter(self.items, function (item) {
              return item.name !== name;
            }));
          }
        });
      },

      // Marks items that have been grouped via the `groups` option — or via
      // `group` calls from modules, combined with the `addGroups` option —
      // with a `menuLeader` property and ensures that the items in a group
      // are consecutive in the order. We'll figure out the final menus at
      // render time so we can handle it properly if an individual
      // user only sees one of them, etc. Called by `afterInit`

      groupItems() {
        // Implement the groups and addGroups options. Mark the grouped items
        // with a `menuLeader` property.
        const groups = self.options.groups || self.groups.concat(self.options.addGroups || []);

        groups.forEach(function (group) {
          if (!group.label) {
            return;
          }

          self.groupLabels[group.items[0]] = group.label;

          group.items.forEach(function (name, groupIndex) {
            const item = _.find(self.items, { name: name });
            if (item) {
              item.menuLeader = group.items[0];
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
              let indexMe = _.findIndex(self.items, { name: name });
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
          items: items,
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
            aposMode: context.aposMode,
            aposLocale: context.aposLocale,
            aposDocId: context.aposDocId
          },
          // Base API URL appropriate to the context document
          contextBar: context && self.apos.doc.getManager(context.type).options.contextBar,
          // Simplifies frontend logic
          contextId: context && context._id,
          tabId: cuid(),
          contextEditorName,
          pageTree: self.options.pageTree && self.apos.permission.can(req, 'edit', '@apostrophecms/any-page-type', 'draft')
        };
      }
    };
  }
};

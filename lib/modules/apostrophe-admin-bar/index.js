// The admin bar module implements Apostrophe's admin bar at the top of the screen. Any module
// can register a button (or more than one) for this bar by calling the `add` method of this
// module. Buttons can also be grouped into dropdown menus and restricted to those with
// particular permissions. [apostrophe-pieces](../apostrophe-pieces/index.html) automatically
// takes advantage of this module.
//
// The admin bar slides out on all pages by default. It's possible to modify this behavior
// by adding one of the following options in app.js:
// ```
// modules: {
//   'apostrophe-admin-bar': {
//     openOnLoad: false,
//     openOnHomepageLoad: true,
//     closeDelay: 5000
//   },
//   .... more modules ...
// }
// ```
// In the above example, the admin bar stays closed on all sub pages of the site, but opens on the
// homepage and stays open for 5 seconds (default is 3 seconds).
// `closeDelay` is a global configuration and changes both the homepage and all subpages.

const _ = require('lodash');

module.exports = {

  alias: 'adminBar',

  afterConstruct: function(self) {
    self.enableBrowserData();
  },

  construct: function(self, options) {

    self.items = [];
    self.groups = [];
    self.groupLabels = {};

    // Add an item to the admin bar.
    //
    // When the item is activated, the `name` argument will be emitted on
    // `apos.bus` as the value of an `admin-bar-item` event. The
    // `ApostropheModals` app will typically catch this and respond by
    // displaying the appropriate modal. So in most cases `name` should
    // be the appropriate modal component name, such as
    // `ApostropheUsersManagerModal`.
    //
    // Alternatively, `href` may be set to an ordinary URL. This is used
    // for the logout button in the admin bar.
    //
    // `permission` should be a permission name such as `admin`
    // (the user must be a full admin) or `edit-apostrophe-event`
    // (the user can create events and edit their own). If
    // `permission` is null then being logged in is
    // good enough to see the item. (Securing your backend routes that
    // respond to user actions is up to you.)
    //
    // You can use the `after` option to specify an admin bar item name
    // this item should appear immediately following.
    //
    // Usually just one admin bar item per module makes sense, and
    // the appropriate Vue component name is found via
    // the `self.componentName()` method of the module.
    //
    // For example, the blog module (and every pieces subclass) does this:
    //
    // ```
    // self.apos.adminBar.add(self.componentName('ManagerModal'), self.pluralLabel, 'edit')
    // ```
    //
    // This results in the component name `ApostropheBlogManagerModal`.
    //
    // On the browser side, it is possible to write
    // `apos.bus.$on('adminBarItem', (name) => { ... })` to catch
    // these events and respond. You can use this mechanism if you
    // wish to implement a custom admin bar item not powered by
    // the `ApostropheModals` app.

    self.add = function(name, label, permission, options) {
      let index;
      const item = {
        name: name,
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
    };

    // Group several menu items together in the interface (currently
    // implemented as a dropdown menu). If `items` is an array of menu
    // item names, then the group's label is the same as the label of
    // the first item. If you wish the label to differ from the label
    // of the first item, instead pass an object with a `label` property
    // and an `items` property.

    self.group = function(items) {
      self.groups.push(items);
    };

    self.getVisibleItems = function(req) {
      // Find the subset of admin bar items this user is permitted to see
      const user = req.user;
      if (!user) {
        return [];
      }
      const items = _.filter(self.items, function(item) {
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
      _.each(items, function(item, i) {
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
        if ((item.menuLeader === item.name) && (items[i + 1] && items[i + 1].menuLeader === item.name)) {
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
    };

    // Like the assets module, we wait as long as humanly possible
    // to lock down the list of admin bar items, so that other modules
    // can bicker amongst themselves even during the `modulesReady` stage.
    // When we get to `afterInit`, we can no longer wait! Order and
    // group the admin bar items.

    self.on('apostrophe:afterInit', 'orderAndGroupItems', function() {
      self.orderItems();
      self.groupItems();
    });

    // Implement the `order` option. This insertion sort results
    // in putting everything otherwise unspecified at the end, as desired.
    // Items with the `last: true` option are moved to the end before the
    // explicit order is applied.
    //
    // Called by `afterInit`

    self.orderItems = function() {
      // Items with a preference to go last go last...
      const moving = [];
      while (true) {
        const moveIndex = _.findIndex(self.items, function(item) {
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
      _.each(self.options.order || [], function(name) {
        const item = _.find(self.items, { name: name });
        if (item) {
          self.items = [ item ].concat(_.filter(self.items, function(item) {
            return item.name !== name;
          }));
        }
      });
    };

    // Marks items that have been grouped via the `groups` option — or via
    // `group` calls from modules, combined with the `addGroups` option —
    // with a `menuLeader` property and ensures that the items in a group
    // are consecutive in the order. We'll figure out the final menus at
    // render time so we can handle it properly if an individual
    // user only sees one of them, etc. Called by `afterInit`

    self.groupItems = function() {
      // Implement the groups and addGroups options. Mark the grouped items with a
      // `menuLeader` property.
      _.each(self.options.groups || self.groups.concat(self.options.addGroups || []), function(group) {
        if (group.label) {
          self.groupLabels[group.items[0]] = group.label;
          group = group.items;
        }
        _.each(group, function(name, groupIndex) {
          const item = _.find(self.items, { name: name });
          if (item) {
            item.menuLeader = group[0];
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
            if (indexMe !== (indexLeader + groupIndex)) {
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
    };

    // Determine if the specified admin bar item object should
    // be rendered or not, for the given req; based on item.permission
    // if any. `req.user` is guaranteed to exist at this point.

    self.itemIsVisible = function(req, item) {
      if (!item.permission) {
        // Being logged in is good enough to see this
        return true;
      }
      return self.apos.permissions.can(req, item.permission);
    };

    self.getBrowserData = function(req) {
      const items = self.getVisibleItems(req);
      if (!items.length) {
        return false;
      }
      const closeDelay = self.options.closeDelay;
      return {
        items: items,
        components: {
          the: 'TheApostropheAdminBar'
        },
        openOnLoad: (!!(typeof self.options.openOnLoad === 'undefined' || self.options.openOnLoad)),
        openOnHomepageLoad: (!!(typeof self.options.openOnHomepageLoad === 'undefined' || self.options.openOnHomepageLoad)),
        closeDelay: typeof closeDelay === 'number' ? closeDelay : 3000
      };
    };

  }
};

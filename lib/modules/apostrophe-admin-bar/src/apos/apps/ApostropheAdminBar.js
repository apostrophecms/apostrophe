import Vue from 'apostrophe/vue';

new Vue({
  el: '#apos-admin-bar',
  template: '<component :items="apos.adminBar.items" :is="apos.adminBar.components.the" />',
});

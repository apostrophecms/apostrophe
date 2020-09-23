import Vue from 'apostrophe/vue';
import 'es6-promise/auto'; // for IE
import { store } from '../store';

export default function() {
  return new Vue({
    el: '#apos-modals',
    computed: {
      apos () {
        return window.apos;
      }
    },
    // apos.modal.components.the, apos.modal.modals
    template: '<component :is="apos.modal.components.the" :modals="apos.modal.modals" />',
    store
  });
};

import Vue from 'apostrophe/vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export const store = new Vuex.Store({
  state: {
    doc: {}
  },
  mutations: {
    setDoc (state, payload) {
      state.doc = payload;
    },
    modifyDoc (state, payload) {
      state.doc = { ...state.doc, ...payload };
    }
  },
  getters: {},
  actions: {}
});

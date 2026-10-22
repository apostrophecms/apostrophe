export default () => {
  apos.getActiveLocale = () => apos.modal?.getActiveLocale?.() || apos.locale;
};

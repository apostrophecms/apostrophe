module.exports = {
  add: {
    title: {
      label: 'aposI18nStatic:key',
      type: 'string',
      required: true
    },
    slug: {
      type: 'slug',
      label: 'apostrophe:slug',
      following: [ 'title', 'archived' ],
      required: true,
      readOnly: true
    },
    namespace: {
      label: 'aposI18nStatic:namespace',
      type: 'select',
      choices: 'getNamespaces',
      def: 'default',
      required: true
    },
    valueSingular: {
      label: 'aposI18nStatic:valueSingular',
      type: 'string',
      required: true,
      i18nValue: true,
      weight: 20
    },
    valuePlural: {
      label: 'aposI18nStatic:valuePlural',
      type: 'string',
      i18nValue: true,
      weight: 20
    },
    valueZero: {
      label: 'aposI18nStatic:valueZero',
      type: 'string',
      help: 'aposI18nStatic:ifApplicableInThisLocale',
      i18nValue: true,
      weight: 20
    },
    valuePluralTwo: {
      label: 'aposI18nStatic:valuePluralTwo',
      type: 'string',
      help: 'aposI18nStatic:ifApplicableInThisLocale',
      i18nValue: true,
      weight: 20
    },
    valuePluralFew: {
      label: 'aposI18nStatic:valuePluralFew',
      type: 'string',
      help: 'aposI18nStatic:ifApplicableInThisLocale',
      i18nValue: true,
      weight: 20
    },
    valuePluralMany: {
      label: 'aposI18nStatic:valuePluralMany',
      type: 'string',
      help: 'aposI18nStatic:ifApplicableInThisLocale',
      i18nValue: true,
      weight: 20
    }
  },
  group: {
    basics: {
      fields: [ 'key', 'namespace', 'valueSingular', 'valuePlural' ]
    },
    specifics: {
      label: 'aposI18nStatic:localeSpecificsForms',
      fields: [ 'valueZero', 'valuePluralTwo', 'valuePluralFew', 'valuePluralMany' ]
    }
  }
};

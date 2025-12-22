module.exports = self => {
  return {
    // Renders style element for use inside widget templates.
    // Used only when widget opts out of automatic stylesWrapper
    // via option `stylesWrapper: false`.
    // Example usage in widget.html:
    // {%- set styles = apos.styles.render(data.widget) -%}
    // {{ apos.styles.elements(styles) }}
    // <article {{ apos.styles.attributes(styles, { class: 'fancy-article' }) }}>
    //   ...content ...
    // </article>
    render(widget) {
      const prepared = self.apos.template.safe(
        self.prepareWidgetStyles(widget)
      );
      console.log('prepared', prepared);
      return prepared;
    },
    elements(styles) {
      const elem = self.apos.template.safe(
        self.getWidgetElements(styles)
      );

      console.log('elem', elem);
      return elem;
    },
    attributes(styles, additionalAttributes = {}) {
      const attr = self.apos.template.safe(
        self.getWidgetAttributes(styles, additionalAttributes)
      );

      console.log('attr', attr);
      return attr;
    }
  };
};

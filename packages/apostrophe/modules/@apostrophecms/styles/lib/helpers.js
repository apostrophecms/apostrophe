module.exports = self => {
  return {
    // Renders style element for use inside widget templates.
    // Used only when widget opts out of automatic stylesWrapper
    // via option `stylesWrapper: false`.
    // Example usage in widget.html:
    // {%- set styles = apos.styles.render(data.widget) -%}
    // {{ apos.styles.elements(styles, data.scene) }}
    // <article {{ apos.styles.attributes(styles, { class: 'fancy-article' }) }}>
    //   ...content ...
    // </article>
    render(widget) {
      return self.apos.template.safe(
        self.prepareWidgetStyles(widget)
      );
    },
    elements(styles, scene) {
      return self.apos.template.safe(
        self.getWidgetElements(styles, { scene })
      );
    },
    attributes(styles, additionalAttributes = {}, options = {}) {
      return self.apos.template.safe(
        self.getWidgetAttributes(styles, additionalAttributes, options)
      );
    }
  };
};

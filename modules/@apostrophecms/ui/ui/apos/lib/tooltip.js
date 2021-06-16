export default {
  updateOptions (tooltipObject) {
    tooltipObject.options.defaultOffset = '11';
    tooltipObject.options.defaultPlacement = 'bottom-end';
    tooltipObject.options.defaultTemplate = `
      <div class="apos-tooltip" role="tooltip">
        <div class="apos-tooltip__arrow"></div>
        <div class="apos-tooltip__inner"></div>
      </div>`;
    tooltipObject.options.defaultArrowSelector = '.apos-tooltip__arrow';
    tooltipObject.options.defaultInnerSelector = '.apos-tooltip__inner';
  }
};

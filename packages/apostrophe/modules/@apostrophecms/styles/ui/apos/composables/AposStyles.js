import {
  ref, reactive, onBeforeUnmount
} from 'vue';
import { renderScopedStyles } from 'Modules/@apostrophecms/styles/universal/render.mjs';
import checkIfConditions from 'apostrophe/lib/universal/check-if-conditions.mjs';
import { createId } from '@paralleldrive/cuid2';

export function useAposStyles() {
  const widgetStyles = reactive({
    inline: '',
    classes: [],
    css: ''
  });
  const widgetId = ref(createId());
  const styleTagId = ref(createId());

  onBeforeUnmount(() => {
    removeStyleTag();
  });

  function getWidgetStyles(doc, moduleOptions) {
    const { schema, stylesFields } = moduleOptions;
    if (!schema || !stylesFields) {
      return;
    }

    const styles = renderScopedStyles(schema, doc, {
      rootSelector: `#${widgetId.value}`,
      checkIfConditionsFn: checkIfConditions,
      subset: stylesFields
    });

    Object.assign(widgetStyles, styles);

    injectStyleTag();
  }

  function injectStyleTag() {
    const css = widgetStyles.css;
    if (!css) {
      removeStyleTag();
      return;
    }

    const styleEl = document.getElementById(styleTagId.value);
    if (!styleEl) {
      const newStyle = document.createElement('style');
      newStyle.id = styleTagId.value;
      newStyle.textContent = css;
      document.head.appendChild(newStyle);
    } else {
      styleEl.textContent = css;
    }
  }

  function removeStyleTag() {
    const styleEl = document.getElementById(styleTagId.value);
    if (styleEl) {
      styleEl.remove();
    }
  }

  return {
    widgetStyles,
    styleTagId,
    widgetId,
    getWidgetStyles,
    removeStyleTag
  };
}

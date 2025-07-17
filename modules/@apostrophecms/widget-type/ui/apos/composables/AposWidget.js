
import { isEqual } from 'lodash';
import {
  ref, unref, computed, nextTick
} from 'vue';

// When modifyin this file, verify that `AposWidgetMixin.js` still works
export function useAposWidget(props) {
  const rendered = ref('...');

  const moduleOptions = computed(() => {
    return apos.modules[apos.area.widgetManagers[props.type]];
  });

  return {
    rendered,
    renderContent,
    getClasses: () => _getClasses({
      modelValue: props.modelValue,
      moduleOptions
    })
  };

  async function renderContent() {
    rendered.value = await _renderContent(props);
    nextTick(() => {
      _emitWidgetRendered({ aposLivePreview: props.aposLivePreview });
    });
  }
};

export function _getClasses(_modelValue, _moduleOptions) {
  const moduleOptions = unref(_moduleOptions);
  const modelValue = unref(_modelValue);
  const { placeholderClass } = moduleOptions;

  if (!placeholderClass) {
    return {};
  }

  return {
    [placeholderClass]: modelValue.aposPlaceholder === true
  };
}

export async function _renderContent(props) {
  apos.bus.$emit('widget-rendering');
  const {
    aposLivePreview,
    ...widget
  } = props.modelValue;
  const body = {
    _docId: props.docId,
    widget,
    areaFieldId: props.areaFieldId,
    type: props.type,
    livePreview: props.aposLivePreview
  };
  try {
    if (props.rendering && (isEqual(props.rendering.parameters, body))) {
      return props.rendering.html;
    } else {
      // Don't use a placeholder here, it causes flickering in live preview
      // mode. It is better to display the old until we display the new, we
      // have "busy" for clarity
      const result = await apos.http.post(`${apos.area.action}/render-widget?aposEdit=1&aposMode=${props.mode}`, {
        busy: !props.aposLivePreview,
        body
      });
      if (result !== 'aposLivePreviewSchemaNotYetValid') {
        return result;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Unable to render widget. Possibly the schema has been changed and the existing widget does not pass validation.', e);
    return '<p>Unable to render this widget.</p>';
  }
}

// Wait for reactivity to render v-html so that markup is
// in the DOM before hinting that it might be time to prepare
// sub-area editors and run players (done in mixin and composable)
export function _emitWidgetRendered({ aposLivePreview }) {
  apos.bus.$emit('widget-rendered', { edit: !aposLivePreview });
}

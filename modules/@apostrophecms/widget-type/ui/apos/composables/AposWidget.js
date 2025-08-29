import { isEqual } from 'lodash';
import {
  ref, unref, computed, nextTick
} from 'vue';

// When modifying this file, verify that `AposWidgetMixin.js` still works
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
    const result = await _renderContent(props);
    if (Object.hasOwn(result, 'data')) {
      rendered.value = result.data;
    }
    if (!result.error) {
      nextTick(() => {
        _emitWidgetRendered(props.modelValue.aposLivePreview);
      });
    }
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
  const parameters = {
    _docId: props.docId,
    widget,
    areaFieldId: props.areaFieldId,
    type: props.type
  };
  try {
    if (props.rendering && (isEqual(props.rendering.parameters, parameters))) {
      return { data: props.rendering.html };
    }
    // Don't use a placeholder here, it causes flickering in live preview
    // mode. It is better to display the old until we display the new, we
    // have "busy" for clarity
    const result = await apos.http.post(
      `${apos.area.action}/render-widget?aposEdit=1&aposMode=${props.mode}`,
      {
        busy: !aposLivePreview,
        body: {
          ...parameters,
          livePreview: aposLivePreview
        }
      });
    if (result !== 'aposLivePreviewSchemaNotYetValid') {
      return { data: result };
    }
    return {};
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Unable to render widget. Possibly the schema has been changed and the existing widget does not pass validation.', e);
    return {
      data: '<p>Unable to render this widget.</p>',
      error: true
    };
  }
}

// Wait for reactivity to render v-html so that markup is
// in the DOM before hinting that it might be time to prepare
// sub-area editors and run players (done in mixin and composable)
export function _emitWidgetRendered(aposLivePreview) {
  apos.bus.$emit('widget-rendered', { edit: !aposLivePreview });
}

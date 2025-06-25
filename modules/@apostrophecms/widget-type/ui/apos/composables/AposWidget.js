
import { isEqual } from 'lodash';
import {
  ref, unref, watch, onMounted, computed, nextTick
} from 'vue';

// When modifyin this file, verify that `AposWidgetMixin.js` still works
export function useAposWidget(data) {
  const rendered = ref('...');

  const moduleOptions = computed(() => {
    return apos.modules[apos.area.widgetManagers[data.type]];
  });

  watch(data.modelValue, () => {
    renderContent();
  });

  onMounted(() => {
    renderContent();
  });

  return {
    rendered,
    getClasses: () => _getClasses({
      modelValue: data.modelValue,
      moduleOptions
    })
  };

  async function renderContent() {
    rendered.value = await _renderContent(data);
    nextTick(() => {
      _emitWidgetRendered({ aposLivePreview: data.aposLivePreview });
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

export async function _renderContent(data) {
  const modelValue = unref(data.modelValue);
  const docId = unref(data.docId);
  const areaFieldId = unref(data.areaFieldId);
  const rendering = unref(data.rendering);
  const mode = unref(data.mode);
  const type = unref(data.type);

  apos.bus.$emit('widget-rendering');
  const {
    aposLivePreview,
    ...widget
  } = modelValue;
  const body = {
    _docId: docId,
    widget,
    areaFieldId,
    type,
    livePreview: aposLivePreview
  };
  try {
    if (rendering && (isEqual(rendering.parameters, body))) {
      return rendering.html;
    } else {
      // Don't use a placeholder here, it causes flickering in live preview
      // mode. It is better to display the old until we display the new, we
      // have "busy" for clarity
      const result = await apos.http.post(`${apos.area.action}/render-widget?aposEdit=1&aposMode=${mode}`, {
        busy: !aposLivePreview,
        body
      });
        //
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

// Vue plugin. Create a new directive with i18n support by applying the decorator
import { $t } from './i18next';
import {
  computePosition, arrow, offset, flip, shift
} from '@floating-ui/dom';
import { createId } from '@paralleldrive/cuid2';
import { isEqual } from 'lodash';

const getTooltipHtml = (id, tooltip) =>
  `<div id="${id}" class="apos-tooltip" role="tooltip">
    <div class="apos-tooltip__wrapper">
      <div class="apos-tooltip__arrow"></div>
      <div class="apos-tooltip__inner">
        ${tooltip}
      </div>
    </div>
  </div>`;

export default {
  install(app) {
    app.directive('apos-tooltip', {
      mounted(el, binding, vnodes) {
        addEventListeners(el, binding);
      },
      updated(el, binding) {
        const contentValue = Object.hasOwn(binding.value || {}, 'content')
          ? binding.value.content
          : binding.value;
        const oldValue = Object.hasOwn(binding.oldValue || {}, 'content')
          ? binding.oldValue.content
          : binding.oldValue;

        if (isEqual(contentValue, oldValue)) {
          return;
        }

        if (el.aposShowTooltipListener) {
          removeEventListeners(el);
        }

        addEventListeners(el, binding);
      },
      beforeUnmount(el, binding) {
        removeEventListeners(el);
      }
    });

    function addEventListeners(el, binding) {
      let tooltipTimeout;
      let delayTimeout;
      if (!binding.value && !binding.value?.content) {
        return;
      }

      const delay = binding.value?.delay;
      const localized = localize(binding.value, app);
      if (!localized) {
        return;
      }
      const tooltipId = `tooltip__${createId()}`;

      // Attach event listeners to elements to retrieve them in beforeUnmount
      el.aposShowTooltipListener = setupShowTooltip({
        el,
        value: binding.value,
        tooltipTimeout,
        delayTimeout,
        tooltipId,
        localized
      });
      el.aposHideTooltipListener = setupHideTooltip({
        tooltipId,
        tooltipTimeout,
        delayTimeout,
        delay
      });

      el.addEventListener('mouseenter', el.aposShowTooltipListener);
      el.addEventListener('mouseleave', el.aposHideTooltipListener);
      el.addEventListener('click', el.aposHideTooltipListener);

    }

    function removeEventListeners(el) {
      if (el.aposHideTooltipListener) {
        el.aposHideTooltipListener(true);
      }
      el.removeEventListener('mouseenter', el.aposShowTooltipListener);
      el.removeEventListener('mouseleave', el.aposHideTooltipListener);
      el.removeEventListener('click', el.aposHideTooltipListener);
    }

    function setupShowTooltip({
      el, value, tooltipTimeout, delayTimeout, tooltipId, localized
    }) {
      return async () => {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
        }
        if (delayTimeout) {
          clearTimeout(delayTimeout);
        }

        const existingEl = document.querySelector(`#${tooltipId}`);
        if (!existingEl) {
          document.body.insertAdjacentHTML('beforeend', getTooltipHtml(tooltipId, localized));
        } else {
          existingEl.setAttribute('aria-hidden', false);
        }

        const tooltipEl = existingEl || document.querySelector(`#${tooltipId}`);
        if (!tooltipEl) {
          return;
        }

        const arrowEl = tooltipEl.querySelector('.apos-tooltip__arrow');

        const {
          x, y, middlewareData, placement
        } = await computePosition(el, tooltipEl, {
          placement: value.placement || 'bottom-end',
          middleware: [
            offset(11),
            shift({ padding: 5 }),
            flip(),
            arrow({
              element: arrowEl,
              padding: 10
            })
          ]
        });

        const [ sidePosition ] = placement.split('-');

        const { x: arrowX, y: arrowY } = middlewareData.arrow;
        if (!existingEl) {
          tooltipEl.setAttribute('x-placement', sidePosition);
          tooltipEl.setAttribute('aria-hidden', false);
        }
        Object.assign(tooltipEl.style, {
          left: `${x}px`,
          top: `${y}px`
        });

        Object.assign(arrowEl.style, {
          ...arrowX && { left: `${arrowX}px` },
          ...arrowY && { top: `${arrowY}px` }
        });
      };
    }

    function setupHideTooltip({
      tooltipId, tooltipTimeout, delayTimeout, delay
    }) {
      return (immediate = false) => {
        const tooltipEl = document.querySelector(`#${tooltipId}`);
        if (!tooltipEl) {
          return;
        }

        if (immediate) {
          tooltipEl.remove();
          return;
        }

        if (delay) {
          delayTimeout = setTimeout(() => {
            tooltipEl.setAttribute('aria-hidden', true);
          }, delay);
        } else {
          tooltipEl.setAttribute('aria-hidden', true);
        }

        tooltipTimeout = setTimeout(() => {
          tooltipEl.remove();
        }, 5000);
      };
    }

    function localize(value) {
      if (!value) {
        return;
      }

      if (value.content) {
        return (value.localize === false) ? value.content : $t(value.content);
      }

      return $t(value);
    }
  }
};

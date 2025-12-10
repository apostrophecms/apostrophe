const WIDGET_NAME = '@apostrophecms/form-file-field';
const WIDGET_SELECTOR = '[data-apos-form-file]';

export default () => {
  const readableSize = ({ units, size }) => {
    return size < 1000
      ? `${size} ${units.B}`
      : size < 1000 * 1000
        ? `${(size / 1000).toFixed(2)} ${units.KB}`
        : size < 1000 * 1000 * 1000
          ? `${(size / (1000 * 1000)).toFixed(2)} ${units.MB}`
          : `${(size / (1000 * 1000 * 1000)).toFixed(2)} ${units.GB}`;
  };

  const sizeLimiter = (input) => {
    if (!input.dataset.maxSize) {
      return;
    }

    const { files } = input;
    const totalSize = Array.from(files || []).reduce((sum, { size }) => sum + size, 0);

    const units = JSON.parse(input.dataset.fileSizeUnits || '{}');
    const maxSize = input.dataset.maxSize;
    const maxSizeError = (input.dataset.maxSizeError || '').replace(
      '%2$s',
      readableSize({
        size: maxSize,
        units
      })
    );
    if (maxSize && totalSize > maxSize) {
      const error = new Error(
        maxSizeError.replace(
          '%1$s',
          readableSize({
            size: totalSize,
            units
          })
        )
      );
      error.field = input.getAttribute('name');

      throw error;
    }
  };

  apos.aposForm.collectors[WIDGET_NAME] = {
    selector: WIDGET_SELECTOR,
    collector (el) {
      const input = el.querySelector('input[type="file"]');
      sizeLimiter(input);

      return {
        field: input.getAttribute('name'),
        value: 'pending',
        files: input.files
      };
    }
  };
};

export default function() {
  if (apos.settings.restore) {
    apos.modal.execute('AposSettingsManager', {
      restore: apos.settings.restore
    });
    apos.settings.restore = null;
  }
}

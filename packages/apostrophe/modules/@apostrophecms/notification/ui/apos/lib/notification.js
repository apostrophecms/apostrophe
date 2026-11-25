// Notification messages are displayed as text, never parsed as HTML,
// so a message's length is simply the length of the string
export function isLongMessage(message) {
  return (message || '').length > 160;
}

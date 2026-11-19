// A chat's title as the panel shows it, or `null` (a new chat): a continued
// chat is named after the chat it continues until its first message names
// it
export function getChatTitle(chat, $t) {
  if (chat?.title) {
    return chat.title;
  }
  if (chat?.continuedFrom) {
    return $t('apostrophe:assistantContinuedTitle', {
      title: chat.continuedFrom.title || $t('apostrophe:assistantUntitled')
    });
  }
  return null;
}

export async function onMessageCreate(message) {
  if (!message.guild || message.author.bot || !message.member) {
    return;
  }

  const { antiPhishing, antiLink, antiSpam } = message.client.security;

  // Anti-phishing has highest priority — scam messages get removed first
  const blockedByPhishing = await antiPhishing.handleMessage(message);

  if (blockedByPhishing) {
    return;
  }

  const blockedByLink = await antiLink.handleMessage(message);

  if (blockedByLink) {
    return;
  }

  await antiSpam.handleMessage(message);
}

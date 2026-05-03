export async function onGuildMemberAdd(member) {
  if (!member.guild) {
    return;
  }

  const { antiRaid, verifier } = member.client.security;

  await antiRaid.handleJoin(member);
  await verifier.handleMemberJoin(member);
}

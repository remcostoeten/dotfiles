const MATCH = /claude/i;

export async function findClaudeGroups() {
  const groups = await chrome.tabGroups.query({});
  return groups.filter((group) => MATCH.test(group.title ?? ""));
}

async function tabIdsIn(groups) {
  const tabsPerGroup = await Promise.all(groups.map((group) => chrome.tabs.query({ groupId: group.id })));
  return tabsPerGroup.flat().map((tab) => tab.id);
}

export async function closeClaudeGroups() {
  const ids = await tabIdsIn(await findClaudeGroups());
  if (ids.length) await chrome.tabs.remove(ids);
  return ids.length;
}

export async function ungroupClaudeGroups() {
  const ids = await tabIdsIn(await findClaudeGroups());
  if (ids.length) await chrome.tabs.ungroup(ids);
  return ids.length;
}

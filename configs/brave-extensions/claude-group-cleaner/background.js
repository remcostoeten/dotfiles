import { closeClaudeGroups } from "./groups.js";

chrome.commands.onCommand.addListener((command) => {
  if (command === "close-claude-groups") closeClaudeGroups();
});

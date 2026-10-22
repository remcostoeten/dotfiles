import { closeClaudeGroups, findClaudeGroups, ungroupClaudeGroups } from "./groups.js";

const status = document.getElementById("status");
const buttons = [document.getElementById("close"), document.getElementById("ungroup")];

async function refresh() {
  const groups = await findClaudeGroups();
  status.textContent = `${groups.length} Claude group${groups.length === 1 ? "" : "s"} open`;
  buttons.forEach((button) => (button.disabled = groups.length === 0));
}

function bind(button, action, verb) {
  button.addEventListener("click", async () => {
    const count = await action();
    status.textContent = `${verb} ${count} tab${count === 1 ? "" : "s"}`;
    buttons.forEach((b) => (b.disabled = true));
  });
}

bind(buttons[0], closeClaudeGroups, "Closed");
bind(buttons[1], ungroupClaudeGroups, "Ungrouped");
refresh();

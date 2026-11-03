# bpr MCP

`bpr mcp` starts a Model Context Protocol server over stdio. It uses the saved `twg` session for Jira and Bitbucket actions and does not open interactive prompts.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "bpr": {
      "command": "/home/remcostoeten/.config/dotfiles/bin/bpr",
      "args": ["mcp"],
      "env": {
        "BPR_MCP_TWG_BIN": "/home/remcostoeten/.local/bin/twg",
        "BPR_MCP_ALLOWED_PROJECTS": "DCR",
        "BPR_MCP_ALLOWED_REPOS": "workspace/repository"
      }
    }
  }
}
```

The project defaults to `jira_project` in `~/.config/bpr/config.toml`. The Bitbucket repository defaults to `repo_slug` or the current Git origin. Set the allowlists explicitly when the server is started outside a repository.

Available tool groups:

- Jira read, JQL, user lookup, create, update, transition, worklog, and Markdown task trees.
- Jira bulk create and delete with per-item results.
- Bitbucket branch list, create, bulk create, and delete.

Delete tools always return a plan first. Execution requires `confirm: true` and the exact `confirmation_token` from that plan. Bulk operations are limited to 100 items and report partial failures instead of pretending to be transactional.

Task-tree Markdown can use this shape:

```md
# Root task

Context and acceptance criteria.

## Subtasks

### API aanpassen

Endpoint uitbreiden.

- Assignee: alice
- Estimate: 4h
- Time spent: 30m
```

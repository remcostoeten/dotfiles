# CI typecheck snippets

Run `npm run typecheck` as a **parallel, independent** job. Keep it non-blocking
until the typed surface is reliably green, then make it required.

## Bitbucket Pipelines

Define a reusable step, then add it to the parallel block(s):

```yaml
definitions:
  steps:
    - step: &npm-typecheck
        name: Check TypeScript types (tsgo)
        image:
          name: eu.gcr.io/<your-registry>/ci/node-base:20
        script:
          - npm ci
          - npm run typecheck

pipelines:
  default:
    - parallel:
        - step: *npm-typecheck
        # ...existing lint / test steps run alongside
```

To start non-blocking, make the step allowed to fail (Bitbucket has no native
`continue-on-error`; wrap the command):

```yaml
        script:
          - npm ci
          - npm run typecheck || echo "typecheck failed (non-blocking for now)"
```

## GitHub Actions

```yaml
jobs:
  typecheck:
    runs-on: ubuntu-latest
    continue-on-error: true   # remove once the typed surface is green
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
```

Flip to required by deleting `continue-on-error: true` and (optionally) adding
the job to a branch protection rule.

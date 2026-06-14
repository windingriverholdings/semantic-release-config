# @wrsoftware/semantic-release-config

Shared [semantic-release](https://github.com/semantic-release/semantic-release) configuration for all Winding River Software repos. Every managed repo extends this config; the four mandatory release outputs are guaranteed by the shared core.

## The four mandatory outputs

Every release of every managed WRS repo produces all four. They cannot be opted out:

1. A semantic version, computed from conventional commits since the last release.
2. A changelog entry written to `CHANGELOG.md`.
3. A version-number bump committed back to the release branch.
4. A tagged release on the SCM host (GitHub today, portable: see Forge portability).

## The five-plugin chain

The chain is fixed org-wide. Plugin order matters: each step feeds the next.

| Order | Plugin | Role | Forge-coupled? |
|---|---|---|---|
| 1 | `@semantic-release/commit-analyzer` | Computes bump type from commits | No |
| 2 | `@semantic-release/release-notes-generator` | Writes the changelog entry | No |
| 3 | `@semantic-release/changelog` | Persists `CHANGELOG.md` | No |
| 4 | `@semantic-release/git` | Commits bump and changelog | No |
| 5 | `@semantic-release/github` | Creates the tag and forge release | **Yes** |

Only plugin 5 is forge-coupled. See Forge portability below.

## Installation (git-install, pinned tag, no floating ref)

Install directly from GitHub at an exact tag. Never use a caret range or a floating ref.

```sh
npm install github:windingriverholdings/semantic-release-config#v0.2.0
```

Update to a new version by changing the tag in the install command and in `package.json`. No npm registry required.

## Usage

In the consuming repo's `.releaserc.js`:

```js
// .releaserc.js — minimal: no version_file beyond CHANGELOG.md (e.g. a pure Go binary).
// The full five-plugin chain is inherited; nothing needs to be declared here.
module.exports = {
  extends: '@wrsoftware/semantic-release-config'
}
```

**Do NOT declare a top-level `plugins:` array in your `.releaserc.js`.** In semantic-release, a `plugins:` array at the top level of a child config **replaces** the inherited chain entirely, silently dropping all five plugins from the shared config. Override individual plugin options via the `@semantic-release/git` config key instead.

To add your project's `version_file` (a Node `package.json`, a Go const file, a Python `pyproject.toml`, etc.) to the assets the git plugin commits, use the plugin-level config key:

```js
// .releaserc.js — Node project that also bumps package.json.
// Overrides only the git plugin's asset list; the other four plugins are untouched.
module.exports = {
  extends: '@wrsoftware/semantic-release-config',
  // Wrap the plugin override in the top-level plugin name key, not in plugins:[].
  // This merges with the inherited chain rather than replacing it.
  '@semantic-release/git': {
    assets: ['CHANGELOG.md', 'package.json'],
    message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
  }
}
```

To append a deploy-tail plugin (e.g. push a Docker image) after the five-plugin chain, use the `namedPlugins` map to build the array by name rather than by position index:

```js
// .releaserc.js — project that adds a Docker-push deploy tail after the chain.
// References plugins by name (v0.2.0+ API); does not use positional indices.
const base = require('@wrsoftware/semantic-release-config')
const { commitAnalyzer, releaseNotes, changelog, git, github } = base.namedPlugins

module.exports = {
  extends: '@wrsoftware/semantic-release-config',
  plugins: [
    commitAnalyzer,
    releaseNotes,
    changelog,
    git,
    github,
    // Append the project-specific deploy tail after the fixed chain.
    ['@semantic-release/exec', {
      publishCmd: 'docker push wrsoftware/myimage:${nextRelease.version}'
    }]
  ]
}
```

## Mid-chain plugin insertion

Sometimes a project needs to run a step between two of the fixed plugins (for example, patching a Go version constant between the changelog write and the git commit). Reference the named plugins from `namedPlugins` to build the insertion by name; never use position indices such as `slice(0, 3)` or `plugins[4]` because they break silently if the chain reorders or grows.

```js
// .releaserc.js — Go project that patches its version constant between
// the changelog step (3) and the git-commit step (4).
//
// Strategy: build the plugins array explicitly using named exports so the
// insertion point is identified by name, not by index.
const base = require('@wrsoftware/semantic-release-config')
const { commitAnalyzer, releaseNotes, changelog, git, github } = base.namedPlugins

module.exports = {
  extends: '@wrsoftware/semantic-release-config',
  plugins: [
    commitAnalyzer,    // step 1: analyze commits
    releaseNotes,      // step 2: generate notes
    changelog,         // step 3: write CHANGELOG.md

    // Inserted between changelog (3) and git (4):
    // patch the version constant in the Go source file before git commits it.
    ['@semantic-release/exec', {
      prepareCmd: 'sed -i "s/const serverVersion = \\"[^\\\"]*\\"/const serverVersion = \\"${nextRelease.version}\\"/" internal/version/version.go'
    }],

    // step 4: commit CHANGELOG.md and the patched version file
    [git[0], { ...git[1], assets: ['CHANGELOG.md', 'internal/version/version.go'] }],

    github             // step 5: create tag and forge release
  ]
}
```

Key points for any mid-chain insertion:

- Destructure from `base.namedPlugins`, not from `base.plugins` (positional). The names are stable across chain reorders; indices are not.
- When overriding a plugin's options inline (as with `git` above), spread the existing options (`...git[1]`) and add only the delta. This means future changes to the shared default options (e.g. the release commit message) propagate to the consumer automatically.
- The `extends:` line is still present. In semantic-release, `extends` loads the parent config for any key NOT redeclared in the child. Because `plugins:` IS redeclared here, the child array wins. The `branches` and other non-plugin fields still inherit from the shared config.
- Every insertion is a review finding if it violates the "May NOT override" list in the standard (e.g. changing the conventional-commits ruleset or the forge plugin).

## Conventional commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) spec. The commit-analyzer maps types to bump levels:

| Commit type | Release bump |
|---|---|
| `feat:` | minor |
| `fix:`, `perf:`, `revert:` | patch |
| Any type with `BREAKING CHANGE:` footer | major |
| `docs:`, `style:`, `chore:`, `refactor:`, `test:`, `ci:` | none (no release) |

## Forge portability

Only `@semantic-release/github` (plugin 5) is forge-coupled. To migrate the org from GitHub to GitLab:

1. In `index.js`, replace the single line `'@semantic-release/github'` with `'@semantic-release/gitlab'`.
2. Update the CI secret variable from `GITHUB_TOKEN` to `GITLAB_TOKEN` (or the org-standard name at the time).
3. Bump the shared config major version (breaking change; bump to v2.0.0).
4. In each consumer repo: update the tag in `package.json` from `#v0.2.0` to `#v2.0.0`, then run `npm install github:windingriverholdings/semantic-release-config#v2.0.0` to fetch the new version and regenerate `package-lock.json`. Commit both files. The update is not automatic.

No per-repo `.releaserc.js` names a forge, so no `.releaserc.js` editing is required beyond the install pin update.

## CI invocation contract

```yaml
release:
  # Use self-hosted for release jobs (they interact with production infrastructure).
  # Add [self-hosted, builder] only if this job also pushes a Docker image.
  runs-on: self-hosted
  steps:
    - uses: actions/checkout@v6
      with:
        fetch-depth: 0       # required: semantic-release reads full tag history

    - uses: actions/setup-node@v6
      with:
        node-version: '22'

    - name: Install semantic-release and shared config
      run: npm ci            # use npm ci, not npm install, to honour package-lock.json

    - name: Assert forge token is set
      # **REQUIRED:** this pre-flight runs BEFORE npx semantic-release.
      # A missing token would otherwise cause @semantic-release/git to commit the
      # changelog and version bump to main and THEN fail at the forge step, leaving
      # the repo in a partial "released but not tagged" state.
      run: |
        if [ -z "$GITHUB_TOKEN" ]; then
          echo "ERROR: GITHUB_TOKEN is empty. Aborting before git step runs." >&2
          exit 1
        fi

    - name: Release
      id: release          # required: the post-release assert reads outputs from this id
      run: npx semantic-release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Assert version bump matches tag
      # Only runs when a release was actually published (id: release required above).
      if: steps.release.outputs.new_release_published == 'true'
      run: |
        # Replace with the project's actual version_file read command.
        # Example for a Node project reading package.json:
        FILE_VERSION=$(node -p "require('./package.json').version")
        TAG_VERSION="${{ steps.release.outputs.new_release_version }}"
        if [ "$FILE_VERSION" != "$TAG_VERSION" ]; then
          echo "ERROR: version_file shows $FILE_VERSION but tag is $TAG_VERSION" >&2
          exit 1
        fi
```

Key rules from the WRS release standard:
- `fetch-depth: 0` is required: semantic-release must read the full tag history to compute the next version.
- **The forge-token pre-flight assert is REQUIRED** and runs before `npx semantic-release`. Without it, a missing token produces a "released but not tagged" partial state that requires a manual revert.
- The `id: release` on the semantic-release step is required for the post-release assert's `steps.release.outputs` reference to resolve. Without it the assert condition is always false and the guard never fires.
- The post-release assert confirms the version file matches the tag before the job exits.
- `npx semantic-release` runs only on trunk pushes, never on PR builds.
- **No release produced is normal:** if no conventional commit has occurred since the last tag, semantic-release exits 0 and produces no release. This is expected behavior, not a failure. If a release was expected and not produced, inspect the commit log: one or more messages likely used a non-conventional format and were not counted as releasable by `@semantic-release/commit-analyzer`.
- `npm ci` (not `npm install`) honours `package-lock.json` and locks the transitive dependency graph.

## What projects may and may not override

**May override:** `branches`, `version_file` location (via `@semantic-release/git` `assets`), any deploy-tail plugin appended after the chain.

**May NOT override:** the five-plugin chain order, the conventional-commits ruleset, the changelog format, the release-commit message convention, or the forge plugin. Overriding any of these in a per-repo config defeats the define-once guarantee and is a review finding.

## Failure modes

**Released but not tagged:** `@semantic-release/git` committed the bump and changelog to main, but the forge plugin then failed. Recovery: revert the bump commit (`git revert <sha>`, push), fix the root cause (the forge-token pre-flight should have caught a missing token before this step), re-run from a clean state. Do not re-run without reverting: semantic-release may compute a different bump and produce a second conflicting commit.

**No release produced (normal):** semantic-release exits 0 with no release when no conventional commit has occurred since the last tag. This is expected, not a failure. See the CI invocation notes above for the inspection procedure.

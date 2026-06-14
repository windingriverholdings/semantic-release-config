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
npm install github:windingriverholdings/semantic-release-config#v1.0.0
```

Update to a new version by changing the tag in the install command and in `package.json`. No npm registry required.

## Usage

In the consuming repo's `.releaserc.js`:

```js
module.exports = {
  extends: '@wrsoftware/semantic-release-config',

  // Override only the project's own deploy tail.
  // The five-plugin chain above MUST NOT be redeclared here.
  // Allowed overrides: branches, version_file (via git plugin assets),
  // and any project-specific deploy plugin appended after the chain.
}
```

Minimal override for a Node project (only version_file differs from the default):

```js
module.exports = {
  extends: '@wrsoftware/semantic-release-config',
  plugins: [
    // Inherit the five-plugin chain from the shared config.
    // Override only @semantic-release/git to add package.json to the assets.
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md', 'package.json'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
    }]
  ]
}
```

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
4. Re-pin all consumer repos: change `#v1.0.0` to `#v2.0.0` in their install command and `package.json`.

No per-repo `.releaserc.js` names a forge, so no per-repo config editing is required beyond the install pin update.

## CI invocation contract

```yaml
release:
  runs-on: ubuntu-latest   # builder label only needed for Docker-push jobs
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0       # required: semantic-release reads full tag history

    - uses: actions/setup-node@v4
      with:
        node-version: '22'

    - name: Install semantic-release and shared config
      run: npm install semantic-release github:windingriverholdings/semantic-release-config#v1.0.0

    - name: Assert forge token is set
      run: |
        if [ -z "$GITHUB_TOKEN" ]; then
          echo "ERROR: GITHUB_TOKEN is empty. Aborting before git step runs." >&2
          exit 1
        fi

    - name: Release
      run: npx semantic-release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Assert version bump matches tag
      if: steps.release.outputs.new_release_published == 'true'
      run: |
        # Replace with the project's actual version_file read command.
        # Example for package.json:
        FILE_VERSION=$(node -p "require('./package.json').version")
        TAG_VERSION="${{ steps.release.outputs.new_release_version }}"
        if [ "$FILE_VERSION" != "$TAG_VERSION" ]; then
          echo "ERROR: version_file shows $FILE_VERSION but tag is $TAG_VERSION" >&2
          exit 1
        fi
```

Key rules from the WRS release standard:
- `fetch-depth: 0` is required: semantic-release must read the full tag history to compute the next version.
- The forge-token pre-flight assert runs before `npx semantic-release`, so a missing token fails before the git step can produce a partial state.
- The post-release assert confirms the version file matches the tag before the job exits.
- `npx semantic-release` runs only on trunk pushes, never on PR builds.

## What projects may and may not override

**May override:** `branches`, `version_file` location (via `@semantic-release/git` `assets`), any deploy-tail plugin appended after the chain.

**May NOT override:** the five-plugin chain order, the conventional-commits ruleset, the changelog format, the release-commit message convention, or the forge plugin. Overriding any of these in a per-repo config defeats the define-once guarantee and is a review finding.

## Failure modes

**Released but not tagged:** `@semantic-release/git` committed the bump and changelog to main, but the forge plugin then failed. Recovery: revert the bump commit (`git revert <sha>`, push), fix the root cause (check the forge token pre-flight), re-run from a clean state. Do not re-run without reverting: semantic-release may compute a different bump and produce a second conflicting commit.

**No release produced:** semantic-release exits 0 with no release when no conventional commit has occurred since the last tag. Check the commit log: one or more messages likely used a non-conventional format and were not counted as releasable.

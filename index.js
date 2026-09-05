'use strict'

/**
 * Shared semantic-release configuration for Winding River Software.
 *
 * Guarantees the four mandatory release outputs for every managed repo whose
 * release identity can push a commit to the release branch:
 *   1. A semantic version computed from conventional commits since the last release.
 *   2. A changelog entry describing what changed at that version.
 *   3. A version-number bump written to the project's canonical version location.
 *   4. A tagged release of the code at that version on the SCM host.
 *
 * DOCUMENTED EXCEPTION (README "Branch-protection exception", openbrain
 * precedent): a repo whose release branch is protected against its own
 * release identity (GITHUB_TOKEN only, no bot-bypass rule) may drop
 * `changelog` and `git` from its plugin array. Outputs 2 and 3 are then
 * satisfied differently: the changelog lives only in the release notes
 * (outputs 1/4's `releaseNotes` + `github` plugins), and the version bump is
 * stamped into the build artifact at build time instead of committed to a
 * source file. See the README before relying on this: it applies only to
 * that specific branch-protection case, not as a general opt-out.
 *
 * The five-plugin chain is fixed org-wide. The only forge-coupled plugin is
 * @semantic-release/github (position 5). To swap forges, replace that one
 * plugin name and its env token; the other four plugins are forge-agnostic.
 *
 * Per-project overrides (artifact, version_file, deploy tail) belong in the
 * project's .releaserc.js extends block, never here.
 *
 * Consumption (git-install, pinned tag, no floating ref):
 *   npm install github:windingriverholdings/semantic-release-config#v0.2.0
 *   # in .releaserc.js:
 *   extends: '@wrsoftware/semantic-release-config'
 *
 * Named plugin exports (v0.2.0+):
 *   const { plugins } = require('@wrsoftware/semantic-release-config')
 *   // plugins.commitAnalyzer, plugins.releaseNotes, plugins.changelog,
 *   // plugins.git, plugins.github
 *   // Use these to insert mid-chain plugins by name, not by position index.
 */

// ---------------------------------------------------------------------------
// KM-680: correct the version bump and release notes for merge-commit PRs
// under the org-wide never-squash doctrine (development-workflow.md).
//
// THE DEFECT: every managed repo merges PRs as regular merge commits, never
// squash, so a PR lands as a merge commit whose FIRST line is
//   Merge pull request #NNN from <branch>
// and whose conventional-commit type (the PR title) sits in the SECOND line
// (the merge-commit body). conventional-commits-parser reads only the FIRST
// line for the type, so a feat/fix whose type lives only in the PR title is
// parsed as typeless and contributes NOTHING: it drops out of both the bump
// computation and the notes. This is exactly how openknowledge's KM-674 (a
// feat) was computed as a PATCH and dropped from the v0.22.0 notes: its
// individual commits used the bracketed [KM-674] WIP form, so the feat type
// survived only in the merge #283 body. First fixed locally in
// openknowledge's .releaserc.js; this port makes the fix org-wide so every
// consumer gets it without a per-repo override.
//
// THE FIX (config-only, no per-merge human discipline): give the parser a
// mergePattern. conventional-commits-parser, when the first line matches
// mergePattern, records the merge correspondence fields (id, source) and then
// RE-PARSES the remainder of the message (the body / PR title) as the real
// header, so `feat(wa-131): ...` in the body is typed as a feat. Verified
// empirically against conventional-commits-parser 6.4.0 and a real merge
// commit (91fbe2f) from windingriverholdings/www.alleykatartisans.com: before
// the fix, commit-analyzer computes releaseType null (no release at all,
// the feat is silently dropped) with empty notes; after, it computes minor
// with the WA-131 feat under Features.
//
// This is applied to BOTH the commit-analyzer (bump) and the
// release-notes-generator (notes), because each loads its own parser. Per
// @semantic-release/commit-analyzer load-parser-config.js and
// @semantic-release/release-notes-generator load-changelog-config.js, a
// plugin-level parserOpts is spread OVER the preset's parser opts
// (`{ ...loadedConfig.parser, ...parserOpts }`), so this is purely additive:
// the conventionalcommits preset's headerPattern, breaking-change detection,
// and note keywords are all preserved. Only mergePattern + mergeCorrespondence
// are added.
//
// TRADE-OFF (accepted, safe direction): when a PR's INDIVIDUAL commits are
// ALSO conventionally typed, the merge-commit body now adds one more bullet
// for the same change, so the notes can list a change more than once. This is
// the safe direction: listing a change twice is preferable to dropping it
// entirely. The dominant bracketed [PROJ-NNN] WIP commit convention never
// parses as a conventional type, so those PRs produce ZERO duplication and
// only the curated PR-title line appears.
const mergeParserOpts = {
  mergePattern: /^Merge pull request #(\d+) from (.*)$/,
  mergeCorrespondence: ['id', 'source']
}

// ---------------------------------------------------------------------------
// Individual plugin definitions.
// Each is a standalone value so consumers can reference them by name rather
// than by positional index. The default export assembles them in the fixed
// org-wide order; the named exports expose them for composition.
// ---------------------------------------------------------------------------

/** @type {[string, object]} */
const commitAnalyzer = [
  '@semantic-release/commit-analyzer',
  {
    preset: 'conventionalcommits',
    parserOpts: mergeParserOpts,
    releaseRules: [
      { type: 'feat', release: 'minor' },
      { type: 'fix', release: 'patch' },
      { type: 'perf', release: 'patch' },
      { type: 'revert', release: 'patch' },
      { type: 'docs', release: false },
      { type: 'style', release: false },
      { type: 'chore', release: false },
      { type: 'refactor', release: false },
      { type: 'test', release: false },
      { type: 'ci', release: false },
      { breaking: true, release: 'major' }
    ]
  }
]

/** @type {[string, object]} */
const releaseNotes = [
  '@semantic-release/release-notes-generator',
  {
    preset: 'conventionalcommits',
    parserOpts: mergeParserOpts,
    presetConfig: {
      types: [
        { type: 'feat', section: 'Features' },
        { type: 'fix', section: 'Bug Fixes' },
        { type: 'perf', section: 'Performance' },
        { type: 'revert', section: 'Reverts' },
        { type: 'docs', section: 'Documentation', hidden: true },
        { type: 'chore', section: 'Miscellaneous', hidden: true },
        { type: 'style', section: 'Miscellaneous', hidden: true },
        { type: 'refactor', section: 'Miscellaneous', hidden: true },
        { type: 'test', section: 'Miscellaneous', hidden: true },
        { type: 'ci', section: 'Miscellaneous', hidden: true }
      ]
    }
  }
]

/** @type {string} */
const changelog = '@semantic-release/changelog'

/**
 * Step 4: Commit the version bump and CHANGELOG.md back to the branch.
 * Mandatory output 3: the version-number bump is committed.
 *
 * assets intentionally contains ONLY CHANGELOG.md here. The version_file
 * (package.json, pyproject.toml, a Go const, etc.) is per-project and must
 * be added via override in the consumer's .releaserc.js. Baking package.json
 * in here would break every non-Node consumer (Go, static sites, etc.) or
 * silently no-op the bump when the file does not exist.
 * Forge-agnostic.
 *
 * @type {[string, object]}
 */
const git = [
  '@semantic-release/git',
  {
    assets: ['CHANGELOG.md'],
    message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
  }
]

/**
 * Step 5: Create the tag and the forge release on the SCM host.
 * Mandatory outputs 1 and 4: the semantic version tag and the forge release.
 *
 * FORGE PLUGIN: this is the ONLY forge-coupled plugin in the chain.
 * To swap from GitHub to GitLab:
 *   1. Replace '@semantic-release/github' with '@semantic-release/gitlab' here.
 *   2. Update the CI secret from GITHUB_TOKEN to GITLAB_TOKEN (or the org-standard name).
 *   3. Bump the shared config major version and re-pin all consumer repos.
 *   No per-repo .releaserc.js changes are required.
 *
 * @type {string}
 */
const github = '@semantic-release/github'

// ---------------------------------------------------------------------------
// Named plugin map.
// Exported as `plugins` so consumers can reference each plugin by a stable
// name rather than a position index. Position-based slice/index access breaks
// silently when the chain reorders or grows; name-based access does not.
// ---------------------------------------------------------------------------

/**
 * @type {{
 *   commitAnalyzer: typeof commitAnalyzer,
 *   releaseNotes: typeof releaseNotes,
 *   changelog: typeof changelog,
 *   git: typeof git,
 *   github: typeof github
 * }}
 */
const pluginsByName = {
  commitAnalyzer,
  releaseNotes,
  changelog,
  git,
  github
}

// ---------------------------------------------------------------------------
// Default export: the config object.
// BACKWARD-COMPAT INVARIANT: this object is assembled from the same plugin
// constants used since v0.1.0 and produces the same five-plugin chain in the
// same order; a consumer upgrading by changing only the pin keeps that chain
// and its named exports. KM-680 (v0.3.0) is the one intentional exception:
// commitAnalyzer and releaseNotes now carry parserOpts (mergePattern +
// mergeCorrespondence, see above) so merge-commit PRs bump and release-note
// correctly under the never-squash doctrine. The change is purely additive
// per plugin (existing preset/releaseRules/presetConfig options are
// untouched) and only widens which commits type correctly; see the README
// changelog note for the v0.2.0 -> v0.3.0 upgrade.
// ---------------------------------------------------------------------------

/** @type {import('semantic-release').GlobalConfig} */
const config = {
  branches: ['main'],

  plugins: [
    // Step 1: Analyze commits (conventional-commits preset). Forge-agnostic.
    commitAnalyzer,

    // Step 2: Generate changelog entry for the new version. Forge-agnostic.
    releaseNotes,

    // Step 3: Persist CHANGELOG.md. Forge-agnostic.
    changelog,

    // Step 4: Commit bump and CHANGELOG.md. Forge-agnostic.
    git,

    // Step 5: Create the tag and the forge release. FORGE-COUPLED (github only).
    github
  ]
}

// Attach the named plugin map as a separate key on the default export so
// consumers can access individual plugins without a separate require():
//   const base = require('@wrsoftware/semantic-release-config')
//   base.namedPlugins.git    => the git plugin tuple
//   base.namedPlugins.github => the github plugin string
//
// config.plugins remains the ordered array that semantic-release reads when
// resolving `extends`. Replacing it with the map object would break the
// extends mechanism; that is why the map lives under a distinct key.
config.namedPlugins = pluginsByName

module.exports = config

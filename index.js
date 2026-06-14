'use strict'

/**
 * Shared semantic-release configuration for Winding River Software.
 *
 * Guarantees the four mandatory release outputs for every managed repo:
 *   1. A semantic version computed from conventional commits since the last release.
 *   2. A changelog entry describing what changed at that version.
 *   3. A version-number bump written to the project's canonical version location.
 *   4. A tagged release of the code at that version on the SCM host.
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
// constants as v0.1.0 and produces a byte-identical plugin array. A v0.1.0
// consumer upgrading to v0.2.0 by changing only the pin receives the same
// five-plugin chain. The named exports are purely additive.
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

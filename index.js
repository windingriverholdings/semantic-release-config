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
 *   npm install github:windingriverholdings/semantic-release-config#v1.0.0
 *   # in .releaserc.js:
 *   extends: '@wrsoftware/semantic-release-config'
 */

/** @type {import('semantic-release').GlobalConfig} */
const config = {
  branches: ['main'],

  plugins: [
    // Step 1: Analyze commits using the conventional-commits preset.
    // Computes the bump type (major, minor, patch) from commit messages.
    // Forge-agnostic.
    [
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
    ],

    // Step 2: Generate the changelog entry for the new version.
    // Writes the human-readable release notes that feed into CHANGELOG.md
    // and the forge release body.
    // Forge-agnostic.
    [
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
    ],

    // Step 3: Persist the changelog entry to CHANGELOG.md.
    // Mandatory output 2: the changelog file is updated and committed.
    // Forge-agnostic.
    '@semantic-release/changelog',

    // Step 4: Commit the version bump and CHANGELOG.md back to the branch.
    // Mandatory output 3: the version-number bump is committed.
    // The version_file to patch is per-project (set in assets override).
    // Forge-agnostic.
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ],

    // Step 5: Create the tag and the forge release on the SCM host.
    // Mandatory outputs 1 and 4: the semantic version tag and the forge release.
    //
    // FORGE PLUGIN: this is the ONLY forge-coupled plugin in the chain.
    // To swap from GitHub to GitLab:
    //   1. Replace '@semantic-release/github' with '@semantic-release/gitlab' here.
    //   2. Update the CI secret from GITHUB_TOKEN to GITLAB_TOKEN (or the org-standard name).
    //   3. Bump the shared config major version and re-pin all consumer repos.
    //   No per-repo .releaserc.js changes are required.
    '@semantic-release/github'
  ]
}

module.exports = config

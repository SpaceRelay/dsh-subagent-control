# Publishing checklist

This file is for maintainers and is **not** part of the npm package.

The identity fields are filled in: `author` SpaceRelay, repository
`https://github.com/SpaceRelay/dsh-subagent-control`. If the repository ever
moves, update `package.json` in the same commit — the market checks that the npm
package names its repository back.

The awesome-dsh-plugins index states that *each npm name is checked to name its
repository back*, so a package without a resolvable `repository` will not pass
listing review.

## Publishing via trusted publishing (OIDC)

Releases go through `.github/workflows/publish.yml`. There is no npm token and
no 2FA prompt: the workflow authenticates with GitHub's short-lived OIDC token,
which npm exchanges for a publish credential. This survives the deprecation of
bypass-2FA tokens (direct publishing with a granular token ends January 2027).

One-time setup on npmjs.com — package **Settings → Trusted Publisher → GitHub
Actions**:

| Field | Value |
| --- | --- |
| Organization or user | `SpaceRelay` |
| Repository | `dsh-subagent-control` |
| Workflow filename | `publish.yml` (filename only, must exist in `.github/workflows/`) |
| Environment name | leave empty |
| Allowed actions | check **npm publish** (and `npm dist-tag` if wanted) |

The workflow file must already be on the default branch before binding.

### Release routine

```powershell
# 1. bump the version in package.json and add a CHANGELOG entry
# 2. commit
git commit -am "release: 1.0.1"
# 3. tag and push — the tag triggers the workflow
git tag v1.0.1
git push origin main --tags
```

The job fails on purpose if the tag (`v1.0.1`) and `package.json` version
disagree, if an `.npmrc` or `NODE_AUTH_TOKEN` is present, or if the smoke test
fails. Publishing produces a provenance statement signed via Sigstore, visible
on npmjs.com.

## Manual publish (fallback)

If CI is unavailable, the interactive path still works:

1. `npm run test` → the offline smoke test must print OK.
2. `npm pack --dry-run` → confirm the tarball holds exactly `index.js`,
   `cordis.patch.yml`, `locale/*.json`, `icon.svg`, `README.md`, `LICENSE`,
   `CHANGELOG.md`, `package.json`. No tests, no publishing notes.
3. `npm publish` (`publishConfig.access` is already `public`); the CLI prints an
   `Authenticate your account at:` URL — open it on the phone that holds the
   passkey and approve with the security key.

## Companion packages

Two subpackages ship from this repository, each with its own npm name, its own
workflow and its own tag prefix. The workflows sit next to `publish.yml` and use
the same trusted-publisher setup with a different workflow filename and
`working-directory`.

| Directory | npm name | Workflow | Tag |
| --- | --- | --- | --- |
| `team-limits/` | `dsh-team-limits` | `publish-team-limits.yml` | `team-limits-v<version>` |
| `human-wait/` | `dsh-human-wait` | `publish-human-wait.yml` | `human-wait-v<version>` |

Trusted publishing can only be bound to a name that already exists on npm, so
the **first** release of a new companion is published by hand:

```powershell
cd human-wait
npm test
npm pack --dry-run   # index.js, cordis.patch.yml, locale, icon.svg, README, CHANGELOG, LICENSE, package.json
npm publish          # publishConfig.access is already public
```

Then bind `publish-human-wait.yml` on npmjs.com as described above, and every
later release goes through `git tag human-wait-v<version>`.

## After publishing

1. `npm view dsh-subagent-control name version repository.url` → the repository
   must be the one above.
2. Install it into a profile from the registry spec and confirm the three tool
   names appear:
   `plugin_manager install_bundle target "dsh-subagent-control@1.0.1"`.
3. Add an entry to the market index. `market-entry.template.json` in this
   directory has the shape (`format: 1`); replace the `<…>` placeholders, then
   submit it through the channel the registry maintainers document.

## Not in the package

`test/`, `PUBLISHING.md`, `market-entry.template.json`, `.git`, any profile or
machine path. `files` in `package.json` is the allowlist that enforces this.

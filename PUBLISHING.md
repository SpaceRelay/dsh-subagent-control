# Publishing checklist

This file is for maintainers and is **not** part of the npm package.

The identity fields are filled in: `author` SpaceRelay, repository
`https://github.com/SpaceRelay/dsh-subagent-control`. If the repository ever
moves, update `package.json` in the same commit — the market checks that the npm
package names its repository back.

The awesome-dsh-plugins index states that *each npm name is checked to name its
repository back*, so a package without a resolvable `repository` will not pass
listing review.

## Steps

1. Create the repository, push this directory.
2. Fill the four fields above in `package.json`; keep the name `dsh-subagent-control`.
3. `npm login` (interactive — the maintainer does this, 2FA included).
4. `npm run test` → the offline smoke test must print OK.
5. `npm pack --dry-run` → confirm the tarball holds exactly `index.js`,
   `cordis.patch.yml`, `locale/*.json`, `icon.svg`, `README.md`, `LICENSE`,
   `CHANGELOG.md`, `package.json`. No tests, no publishing notes.
6. `npm publish` (`publishConfig.access` is already `public`).
7. `npm view dsh-subagent-control name version repository.url` → the repository
   must be the one from step 2.
8. Install it into a profile from the registry spec and confirm the three tool
   names appear:
   `plugin_manager install_bundle target "dsh-subagent-control@1.0.0"`.
9. Add an entry to the market index. `market-entry.template.json` in this
   directory has the shape (`format: 1`); replace the `<…>` placeholders, then
   submit it through the channel the registry maintainers document.

## Not in the package

`test/`, `PUBLISHING.md`, `market-entry.template.json`, `.git`, any profile or
machine path. `files` in `package.json` is the allowlist that enforces this.

# Changelog

## 1.3.5

- Removed the leftover debugging path and the trace calls that appended to it on every load. The
  package now carries no absolute paths and writes nothing outside the profile.

## 1.3.4

- The panel description no longer explains where the values are stored. It names the four limits
  and stops; the page itself shows how to edit them.

## 1.3.3

- Dropped the "nothing else is touched" clause from the panel description in both languages. The
  description now states what the page does and stops there.

## 1.3.2

- The panel description now says what the bundle does (adjust the Agent Team limits from the plugin
  page, written onto the agent-team row) instead of quoting one fixed set of numbers, which had
  been stale since 1.2.0 turned the limits into editable fields.
- The README follows the same wording: it points at Settings → Plugins → Installed → Team limits
  and no longer claims a Save button or a standalone Settings page.

## 1.3.1

- The form now lives on the plugin's own page: opening "Team limits" in Plugins → Installed shows
  the four fields right below the bundle description, through the native `plugins.bundle.config`
  slot keyed by the package name. The extra tab in the Plugins section is gone.
- The compact `summary` view of the same slot renders one line (members · tasks · bytes · ms)
  instead of the whole form.

## 1.3.0

- The page now lives where the rest of a plugin's UI lives: **Settings → Plugins → Team limits**,
  as a tab of the Plugins section, instead of a standalone row in the Settings sidebar.
- The page was rebuilt to match the shipped settings pages: a title and one-line introduction,
  section headings, two columns, and per-field "Overridden" markers with a "Restore default"
  action. Edits are applied as you type (debounced), so there is no Save button.
- The four numbers are grouped as "Runtime limits" (members, tasks) and "Messages and teardown"
  (message bytes, disposal timeout).

## 1.2.0

- New: a real settings page, **Settings → Team limits**, with four number fields, Save and
  Restore defaults. Values are written onto the shipped `agent-team` row through the host's
  config editor instead of being frozen in the bundle patch.
- The bundle patch no longer overrides `agent-team`; it only mounts the row, so a DSH upgrade
  that changes the shipped defaults no longer fights with stale numbers in this file.
- Added the browser half (`client.js`, `dsh.client`) and a pinned `maxMembers: 32` starting
  point; the page still lives in the harness Settings shell, so nothing renders in
  terminal-only profiles.

## 1.0.1

- Added a real entry artifact (`index.js`) and `main`/`exports`, fixing the plugin-manager
  validation error "declared entry artifact is missing".
- The bundle now inserts one small component row (`team-limits`) that registers nothing, so the
  plugin panel lists the bundle under "components" instead of reporting that it contains none.
- Added localized title and description (English / 简体中文) and a purpose-drawn icon: the limits
  are documented in the panel instead of only in this README.

## 1.0.0

- First release: overrides the shipped `agent-team` row with `maxMembers: 32`, `maxTasks: 512`,
  `maxMessageBytes: 131072`, `disposalTimeoutMs: 5000`.

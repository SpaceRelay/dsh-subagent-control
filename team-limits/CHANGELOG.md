# Changelog

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

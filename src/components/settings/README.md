# src/components/settings

The controls on `/settings`: `SettingsForm`, one plain-language row per setting and a "Reset settings" button. It reads and writes through `src/lib/settings` (`useSettings`, `updateSettings`, `resetSettings`) and never touches browser storage itself. When a later phase adds a setting, give it a row here with a one-line explanation a beginner understands.

Never import here: features, `src/app`, `src/sim`, or `src/content`.

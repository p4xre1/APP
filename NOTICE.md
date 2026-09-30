# Third-party notices

Fatorati itself is proprietary (see `LICENSE`). It bundles or depends on the
following third-party components. Nothing here changes their licenses.

## Runtime libraries (included in the APK)

| Component | Version | License |
|---|---|---|
| @capacitor/core, @capacitor/android | 8.5.2 | MIT |
| @capacitor/app | 8.1.1 | MIT |
| @capacitor/filesystem | 8.1.3 | MIT |
| @capacitor/haptics | 8.0.2 | MIT |
| @capacitor/keyboard | 8.0.5 | MIT |
| @capacitor/local-notifications | 8.3.1 | MIT |
| @capacitor/preferences | 8.0.1 | MIT |
| @capacitor/share | 8.0.2 | MIT |
| @capacitor/splash-screen | 8.0.2 | MIT |
| @capacitor/status-bar | 8.0.3 | MIT |
| @capgo/capacitor-native-biometric | 8.7.0 | **MPL-2.0** |
| jspdf | 4.2.x | MIT |
| lucide-react | 1.4x | ISC |
| react, react-dom | 19.x | MIT |
| write-excel-file | 4.1.x | MIT |
| zustand | 5.x | MIT |

### MPL-2.0 note

`@capgo/capacitor-native-biometric` is used **unmodified** as a compiled
dependency. Its source is available at
https://github.com/Cap-go/capacitor-native-biometric (MPL-2.0). Because no
MPL-covered file was modified, this project's own source remains under its own
license; the plugin's files stay under MPL-2.0 and are not vendored into this
repository.

## Development-only tools (not shipped in the APK)

@capacitor/cli (MIT), @tailwindcss/vite and tailwindcss (MIT), @vitejs/plugin-react
(MIT), vite (MIT), typescript (Apache-2.0), tsx (MIT), playwright (Apache-2.0),
fake-indexeddb (Apache-2.0), @types/* (MIT).

`write-excel-file` bundles `fflate` (MIT) to write the .xlsx container. No
network access is involved in generating or opening an export.

## Fonts (bundled as WOFF2 in `public/fonts`)

| Family | License | License text |
|---|---|---|
| Inter | SIL Open Font License 1.1 | `public/fonts/inter-LICENSE.txt` |
| Tajawal | SIL Open Font License 1.1 | `public/fonts/tajawal-LICENSE.txt` |
| Sora | SIL Open Font License 1.1 | `public/fonts/sora-LICENSE.txt` |
| JetBrains Mono | SIL Open Font License 1.1 | `public/fonts/jetbrains-mono-LICENSE.txt` |

Fonts are distributed by Fontsource 5.3.0 and originate from their respective
upstream projects. OFL permits bundling inside proprietary applications as long
as the fonts are not sold by themselves, are not renamed, and the license texts
accompany them — all satisfied here.

## Android platform

The app builds against the Android SDK and AndroidX libraries distributed under
the Apache License 2.0. Gradle and the Android Gradle Plugin are used as build
tools only.

## Trademarks

"Fatorati", the app icon and the bundled artwork are the property of the
copyright holder. Android, Google Play and Gradle are trademarks of their
respective owners and are used only to describe compatibility.

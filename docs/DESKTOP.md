# Fatorati desktop

The desktop edition uses Electron to package the same offline React application for Windows, macOS and Linux. It does not add a server, account, analytics or runtime network dependency. Business records remain encrypted in the desktop WebView's persistent application profile.

## Development

```bash
pnpm install
pnpm desktop:dev
```

The development command starts Vite and the Electron shell together. Closing the desktop window also stops Vite.

## Run the production desktop app locally

```bash
pnpm desktop:start
```

This builds the production web bundle and opens it through the private `fatorati://` application protocol.

## Create installers

```bash
pnpm desktop:dist
```

`electron-builder` writes platform packages to `release/`. Build each target on its native operating system when producing a signed release. Release signing/notarization credentials must be supplied through the build environment and must never be committed.

## Desktop security boundary

- The renderer has no Node.js access (`nodeIntegration: false`).
- Context isolation, Chromium sandboxing and web security are enabled.
- A small preload bridge exposes only a native save dialog and lock notification.
- Popups, navigation away from the bundled app, embedded webviews and permission requests are denied.
- Only one application instance is allowed.
- The vault locks when the window is minimized, the OS session locks, or the machine suspends.
- The existing strict Content Security Policy remains active in packaged builds.

Exports and encrypted backups use a native Save dialog. Cancelling the dialog does not mark a backup as completed.

## Data and backups

Desktop data is local to the operating-system user profile. Removing the application profile or using an OS cleanup tool can delete it. Export encrypted `.fatorati` backups regularly and keep them outside the application-data directory.

Biometric unlock and Android local notifications remain Android-only. The PIN, encrypted IndexedDB vault, PDF/CSV/XLSX exports, import/export, RTL interface and all business modules work in the desktop edition.

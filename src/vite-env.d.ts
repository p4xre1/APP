/// <reference types="vite/client" />

interface FatoratiDesktopBridge {
  readonly isDesktop: true
  readonly platform: 'win32' | 'darwin' | 'linux' | string
  saveFile(filename: string, data: Uint8Array<ArrayBuffer>, mime: string): Promise<{ saved: boolean }>
  onLock(callback: () => void): () => void
}

interface Window {
  readonly fatoratiDesktop?: FatoratiDesktopBridge
}

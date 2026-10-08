export type TabColor = { red: number; green: number; blue: number }

declare module 'claude-code' {
  interface PluginState {
    'tab-tag': { title: string; color: TabColor | null; isNamed: boolean }
  }
}

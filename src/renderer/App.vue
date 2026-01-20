<script setup>
import ConfigPanel from './components/ConfigPanel.vue'
import ServerControl from './components/ServerControl.vue'
import ConsolePanel from './components/Console.vue'
import QuakeCanvas from './components/QuakeCanvas.vue'
import SavegameGrid from './components/SavegameGrid.vue'
import { useServerStore } from './stores/serverStore'
const serverStore = useServerStore()
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>BAKAMULA</h1>
      <span class="subtitle">FTEQW WASM Hub</span>
    </header>

    <main class="app-main">
      <div class="left-panel">
        <ConfigPanel />
        <ServerControl />
        <SavegameGrid :entities="serverStore.snapshotEntities" />
      </div>

      <div class="right-panel">
        <div class="game-view">
          <QuakeCanvas />
        </div>
        <div class="console-view">
          <ConsolePanel />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  gap: 16px;
}

.app-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.app-header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--accent);
}

.subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.app-main {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.right-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.game-view {
  flex: 2;
  min-height: 0;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.console-view {
  flex: 1;
  min-height: 150px;
}
</style>

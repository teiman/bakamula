<script setup>
import { onMounted } from 'vue'
import { useConfigStore } from '../stores/configStore'
import { useServerStore } from '../stores/serverStore'

const configStore = useConfigStore()
const serverStore = useServerStore()

onMounted(() => {
  configStore.loadConfig()
})
</script>

<template>
  <div class="panel">
    <div class="panel-title">Configuration</div>

    <div class="form-group">
      <label>Quake Directory</label>
      <div class="path-input">
        <input
          type="text"
          :value="configStore.quakePath"
          readonly
          placeholder="Select Quake directory..."
        />
        <button
          class="secondary"
          @click="configStore.browseQuakePath"
          :disabled="serverStore.isRunning"
        >
          Browse
        </button>
      </div>
    </div>

    <div class="form-group">
      <label>Mod</label>
      <select
        v-model="configStore.selectedMod"
        :disabled="serverStore.isRunning || !configStore.availableMods.length"
      >
        <option
          v-for="mod in configStore.availableMods"
          :key="mod"
          :value="mod"
        >
          {{ mod }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.path-input {
  display: flex;
  gap: 8px;
}

.path-input input {
  flex: 1;
}

.path-input button {
  flex-shrink: 0;
  padding: 8px 12px;
}
</style>

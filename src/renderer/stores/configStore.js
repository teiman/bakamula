import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useConfigStore = defineStore('config', () => {
  const quakePath = ref('')
  const selectedMod = ref('id1')
  const availableMods = ref([])

  // Load config from electron-store on init
  async function loadConfig() {
    const stored = await window.electronAPI.getConfig('bakamula')
    if (stored) {
      quakePath.value = stored.quakePath || ''
      selectedMod.value = stored.selectedMod || 'id1'
    }

    if (quakePath.value) {
      await loadMods()
    }
  }

  // Save config to electron-store
  async function saveConfig() {
    await window.electronAPI.setConfig('bakamula', {
      quakePath: quakePath.value,
      selectedMod: selectedMod.value
    })
  }

  // Load available mods from Quake directory
  async function loadMods() {
    if (!quakePath.value) {
      availableMods.value = []
      return
    }

    const folders = await window.electronAPI.listSubfolders(quakePath.value)
    availableMods.value = folders.filter(f => !f.startsWith('.'))

    // Ensure selected mod exists
    if (!availableMods.value.includes(selectedMod.value)) {
      selectedMod.value = availableMods.value[0] || 'id1'
    }
  }

  // Browse for Quake directory
  async function browseQuakePath() {
    const path = await window.electronAPI.selectDirectory()
    if (path) {
      quakePath.value = path
      await loadMods()
      await saveConfig()
    }
  }

  // Watch for changes and auto-save
  watch([selectedMod], () => {
    saveConfig()
  })

  return {
    quakePath,
    selectedMod,
    availableMods,
    loadConfig,
    saveConfig,
    loadMods,
    browseQuakePath
  }
})

import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'
import { useConfigStore } from './configStore'

const MAX_CONSOLE_LINES = 1000

export const useServerStore = defineStore('server', () => {
  const configStore = useConfigStore()

  const isRunning = ref(false)
  const isWasmMode = ref(true) // Default to WASM as per new plan
  const isInputCaptured = ref(false)
  const currentMap = ref('')
  const playerCount = ref(0)
  const consoleBuffer = ref([])
  const commandHistory = ref([])
  const historyIndex = ref(-1)
  const isBusy = ref(false)
  const isPolling = ref(false)
  const snapshotEntities = ref([])

  let pollInterval = null

  // Add line to console buffer
  function addToConsole(line) {
    consoleBuffer.value.push(line)
    if (consoleBuffer.value.length > MAX_CONSOLE_LINES) {
      consoleBuffer.value.shift()
    }
  }

  // Parse status output from FTEQW
  function parseStatus(output) {
    if (!output) return

    const mapMatch = output.match(/^map:\s*(\S+)/m)
    const playersMatch = output.match(/^players:\s*(\d+)/m)

    if (mapMatch) currentMap.value = mapMatch[1]
    if (playersMatch) playerCount.value = parseInt(playersMatch[1])
  }

  // Start the server/game
  async function startServer() {
    if (isRunning.value) return

    isBusy.value = true

    try {
      if (isWasmMode.value) {
        // For WASM, "starting" means the component is ready or triggered
        isRunning.value = true
        addToConsole('[WASM Engine starting...]')
      } else {
        // Legacy native code preserved for now but parameters removed
        addToConsole('[Native Server mode is deprecated]')
      }
    } catch (err) {
      addToConsole(`[Error: ${err.message}]`)
    } finally {
      isBusy.value = false
    }
  }

  // Stop the server
  async function stopServer() {
    if (!isRunning.value) return

    if (isWasmMode.value) {
      // For WASM, the only clean way to "stop" and free resources/listeners 
      // is to reload the renderer process.
      window.location.reload()
      return
    }

    isBusy.value = true
    stopPolling()

    try {
      await window.electronAPI.stopServer()
      isRunning.value = false
      currentMap.value = ''
      playerCount.value = 0
      addToConsole('[Server stopped]')
    } catch (err) {
      addToConsole(`[Error: ${err.message}]`)
    } finally {
      isBusy.value = false
    }
  }

  // Send command to server
  async function sendCommand(command) {
    if (!command.trim()) return

    // Add to history
    commandHistory.value.push(command)
    historyIndex.value = commandHistory.value.length

    addToConsole(`> ${command}`)

    isBusy.value = true
    try {
      if (isWasmMode.value) {
        // Direct command injection for WASM
        executeCommand(command)
      } else {
        const response = await window.electronAPI.sendRconCommand(command)
        if (response) {
          addToConsole(response)
        }
      }
    } catch (err) {
      addToConsole(`[Error: ${err.message}]`)
    } finally {
      isBusy.value = false
    }
  }

  // Inject command into WASM engine
  function executeCommand(command) {
    if (window.Module && window.Module.execute) {
      window.Module.execute(command)
    } else {
      addToConsole('[Error] WASM Engine not ready for commands')
    }
  }

  // Navigate command history
  function historyUp() {
    if (historyIndex.value > 0) {
      historyIndex.value--
      return commandHistory.value[historyIndex.value]
    }
    return null
  }

  function historyDown() {
    if (historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++
      return commandHistory.value[historyIndex.value]
    }
    historyIndex.value = commandHistory.value.length
    return ''
  }

  // Polling for server status
  function startPolling() {
    if (pollInterval) return

    pollInterval = setInterval(async () => {
      // Skip if busy or already polling
      if (isBusy.value || isPolling.value || !isRunning.value) return

      isPolling.value = true
      try {
        const response = await window.electronAPI.sendRconCommand('status')
        parseStatus(response)
      } catch {
        // Ignore polling errors
      } finally {
        isPolling.value = false
      }
    }, 1000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  // Snapshot functionality
  async function takeSnapshot() {
    if (!window.Module || !window.Module.execute) {
      addToConsole('[Error] Engine not ready for snapshot')
      return
    }

    addToConsole('[WASM] Taking snapshot...')

    const saveName = 'snapshot'
    window.Module.execute(`save ${saveName}`)

    // Wait for the engine to write the file
    await new Promise(resolve => setTimeout(resolve, 1000))

    try {
      let content = null
      const modDir = configStore.selectedMod || 'id1'

      if (window.Module && window.Module.FS) {
        const possiblePaths = [`/${modDir}/${saveName}.sav`, `/${saveName}.sav`]
        for (const path of possiblePaths) {
          try {
            content = window.Module.FS.readFile(path, { encoding: 'utf8' })
            if (content) break
          } catch (e) { }
        }
      }

      if (!content && window.FTEH && window.FTEH.f) {
        const possibleKeys = [
          `ID1/fte/${saveName}.sav`,
          `${modDir}/fte/${saveName}.sav`,
          `${modDir}/${saveName}.sav`,
          `${saveName}.sav`,
          `${saveName}`
        ]

        for (const key of possibleKeys) {
          let file = window.FTEH.f[key]
          if (!file) {
            const lowerKey = key.toLowerCase()
            const foundKey = Object.keys(window.FTEH.f).find(k => (k || '').toLowerCase() === lowerKey)
            if (foundKey) file = window.FTEH.f[foundKey]
          }

          if (file && file.d) {
            content = new TextDecoder().decode(file.d.subarray(0, file.l))
            break
          }
        }
      }

      if (!content) {
        addToConsole('[Error] Could not find snapshot in WASM filesystem')
        return
      }

      const { parseSavegame } = await import('../utils/savegameParser')
      const entities = parseSavegame(content)

      snapshotEntities.value = entities
      addToConsole(`[WASM] Snapshot captured: ${entities.length} entities`)

    } catch (err) {
      addToConsole(`[Error] Failed to read snapshot: ${err.message}`)
    }
  }

  // Listen for server output
  function setupOutputListener() {
    window.electronAPI.onServerOutput((line) => {
      addToConsole(line)
    })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopPolling()
    window.electronAPI.removeServerOutputListener()
  })

  return {
    isRunning,
    isWasmMode,
    isInputCaptured,
    currentMap,
    playerCount,
    consoleBuffer,
    commandHistory,
    isBusy,
    isPolling,
    snapshotEntities,
    startServer,
    stopServer,
    sendCommand,
    historyUp,
    historyDown,
    takeSnapshot,
    setupOutputListener,
    addToConsole,
    executeCommand
  }
})

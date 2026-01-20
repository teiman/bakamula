"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: (key) => ipcRenderer.invoke("config:get", key),
  setConfig: (key, value) => ipcRenderer.invoke("config:set", key, value),
  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),
  listSubfolders: (path) => ipcRenderer.invoke("fs:listSubfolders", path),
  startServer: (config) => ipcRenderer.invoke("server:start", config),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  getServerStatus: () => ipcRenderer.invoke("server:status"),
  sendRconCommand: (command) => ipcRenderer.invoke("rcon:send", command),
  getGpuStatus: () => ipcRenderer.invoke("gpu:getStatus"),
  onServerOutput: (callback) => {
    ipcRenderer.on("server:output", (_, line) => callback(line));
  },
  readFile: (path) => ipcRenderer.invoke("fs:readFile", path),
  removeServerOutputListener: () => {
    ipcRenderer.removeAllListeners("server:output");
  }
});

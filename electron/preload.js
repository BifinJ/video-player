const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectVideo: () => ipcRenderer.invoke("select-video"),
  startVLC: (videoPath) => ipcRenderer.invoke("start-vlc", videoPath),
  vlcCommand: (command, value) =>
    ipcRenderer.invoke("vlc-command", command, value),
  vlcStatus: () => ipcRenderer.invoke("vlc-status"),
  stopVLC: () => ipcRenderer.invoke("stop-vlc"),
});

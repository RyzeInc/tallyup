const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("tallyup", {
  isDesktop: true
});

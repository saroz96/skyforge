const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
    send: (channel, data) => {
        // Whitelist channels
        let validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        let validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
}
);

// Expose app info
contextBridge.exposeInMainWorld('electron', {
    appVersion: process.env.npm_package_version || '1.0.0',
    platform: process.platform,
    isDev: process.env.NODE_ENV === 'development',
    isElectron: true
});

// Expose app paths
contextBridge.exposeInMainWorld('appPaths', {
    userData: () => ipcRenderer.invoke('get-user-data-path'),
    appData: () => ipcRenderer.invoke('get-app-data-path')
});
/**
 * Application entry point.
 * Initializes the data store, configures the UI layers, and wires up global event listeners.
 */

import { ThemeConfig } from './theme.js';
import { State } from './state.js';
import { Storage } from './storage.js';
import { UIRenderer } from './ui/ui-renderer.js';
import { UIModals } from './ui/ui-modals.js';
import { setupEventListeners } from './events.js';

const App = {
    init() {
        ThemeConfig.init();
        if (!Storage.load()) {
            State.initDefault();
            Storage.save();
        }
        
        UIModals.init();
        UIRenderer.init();
        
        if(window.Coloris) {
            Coloris({
                theme: 'pill',
                formatToggle: true,
                alpha: false,
                swatches: [ '#ffffff', '#fca5a5', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#d8b4fe', '#f9a8d4' ]
            });
        }

        UIRenderer.renderTable();
        UIRenderer.renderSidebarSchedules();
        setupEventListeners();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
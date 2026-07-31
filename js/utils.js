/**
 * Pure helper functions for cross-cutting concerns, including ID sanitization, 
 * string parsing, and color contrast calculations.
 */

export const Utils = {
    sanitizeId: (str) => str.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, ''),
    parseList: (str) => str.split(',').map(s => s.trim().toUpperCase().replace(/\s+/g, '')).filter(s => s.length > 0),
    getContrastColor(colorStr) {
        if (!colorStr) return '#000000';
        let r, g, b;
        if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/\d+/g);
            if (!match || match.length < 3) return '#000000';
            r = parseInt(match[0]);
            g = parseInt(match[1]);
            b = parseInt(match[2]);
        } else {
            let hex = colorStr.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        }
        let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    },
    setColoris(el, color) {
        if (el) {
            el.value = color;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
};
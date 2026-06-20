export const ThemeConfig = {
    init() {
        const saved = localStorage.getItem('themePref');
        if (saved) {
            this.set(saved);
        } else {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.set(isDark ? 'dark' : 'light');
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('themePref')) {
                this.set(e.matches ? 'dark' : 'light');
            }
        });
    },
    toggle() {
        const isDark = document.documentElement.classList.contains('dark');
        this.set(isDark ? 'light' : 'dark');
    },
    set(mode) {
        localStorage.setItem('themePref', mode);
        
        const icon = document.getElementById('theme-icon');
        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
            if(icon) icon.className = 'ph ph-moon text-xl';
        } else {
            document.documentElement.classList.remove('dark');
            if(icon) icon.className = 'ph ph-sun text-xl';
        }
    }
};
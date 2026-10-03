import type { IAppModel } from './app-model.js';

export function renderStartupSplash(model: IAppModel): string {
    return `<style>
            :root {
                color-scheme: light dark;
                --startup-canvas: light-dark(#f3f5f8, #10151c);
                --startup-text: light-dark(#172033, #f3f6fa);
            }
            :root[data-theme='light'] {
                color-scheme: light;
                --startup-canvas: #f3f5f8;
                --startup-text: #172033;
            }
            :root[data-theme='dark'] {
                color-scheme: dark;
                --startup-canvas: #10151c;
                --startup-text: #f3f6fa;
            }
            body {
                margin: 0;
                background-color: var(--startup-canvas);
                color: var(--startup-text);
            }
            .app-startup {
                position: static;
                display: flex;
                flex-direction: column;
                align-items: center;
                box-sizing: border-box;
                width: 100%;
                min-height: 100vh;
                padding-top: 35vh;
            }
            .app-startup-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
            }
            .app-startup-logo {
                width: 4rem;
                height: 4rem;
                flex-shrink: 0;
                user-select: none;
                -webkit-user-select: none;
            }
            .app-startup-name {
                font-family:
                    ui-sans-serif,
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    'Segoe UI',
                    sans-serif;
                font-size: 1.375rem;
                font-weight: 650;
                line-height: 1.25;
                user-select: none;
                -webkit-user-select: none;
            }
        </style>
        <script>
            (() => {
                const root = document.documentElement;
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                let theme = systemTheme;

                try {
                    const storedPreferences = window.localStorage.getItem('esm_viewer_preferences');
                    if (storedPreferences !== null) {
                        const preferences = JSON.parse(storedPreferences);
                        if (preferences !== null && typeof preferences === 'object') {
                            if (
                                typeof preferences.theme === 'string' &&
                                preferences.theme !== 'system' &&
                                preferences.theme.length > 0
                            ) {
                                theme = preferences.theme;
                            }
                        }
                    }
                } catch {
                    theme = systemTheme;
                }

                root.setAttribute('data-theme', theme);
                root.style.removeProperty('color-scheme');
            })();
        </script>
        <div class="app-startup" data-startup-screen>
            <div class="app-startup-content">
                <svg
                    class="app-startup-logo"
                    viewBox="0 0 1024 1024"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <rect
                        x="169"
                        y="178"
                        width="686"
                        height="434"
                        rx="36"
                        fill="currentColor"
                        fill-opacity="0.14"
                        stroke="currentColor"
                        stroke-opacity="0.28"
                        stroke-width="12"
                    />
                    <rect x="238" y="258" width="137" height="110" rx="18" fill="currentColor" fill-opacity="0.28" />
                    <g stroke="currentColor" stroke-opacity="0.45" stroke-width="5" fill="none">
                        <path d="M274 258v110M338 258v110M238 305h137M306 305v63" />
                    </g>
                    <g stroke-linecap="round" fill="none" stroke="currentColor">
                        <path d="M422 293h410" stroke-opacity="0.5" stroke-width="22" />
                        <path d="M422 330h256" stroke-opacity="0.35" stroke-width="16" />
                        <path d="M242 425h548" stroke-opacity="0.25" stroke-width="14" />
                        <path d="M242 462h400" stroke-opacity="0.25" stroke-width="14" />
                        <path d="M242 499h248" stroke-opacity="0.25" stroke-width="14" />
                    </g>
                    <rect
                        x="133"
                        y="681"
                        width="758"
                        height="148"
                        rx="28"
                        fill="currentColor"
                        fill-opacity="0.08"
                        stroke="currentColor"
                        stroke-opacity="0.2"
                        stroke-width="10"
                    />
                    <polyline
                        points="165,755 242,755 279,705 315,805 361,731 407,784 453,755 555,755 590,712 624,801 670,737 727,755 859,755"
                        fill="none"
                        stroke="currentColor"
                        stroke-opacity="0.75"
                        stroke-width="14"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <circle cx="315" cy="805" r="16" fill="currentColor" fill-opacity="0.8" />
                    <circle cx="624" cy="801" r="16" fill="currentColor" fill-opacity="0.8" />
                </svg>
                <span class="app-startup-name">${model.appName}</span>
            </div>
        </div>`;
}

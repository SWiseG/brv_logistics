// Configurações tema
function Themes() {
    return {
        initTheme: () => {
            const colors = themes.getCSSVariables(
                '--off-white', '--white', '--black',
                '--primary-color', '--secondary-color',
                '--fb-info-color', '--fb-danger-color', '--fb-warning-color', '--fb-success-color',
                '--neutral-color', '--shadow-color'
            );

            const normalizedColors = {};
            Object.entries(colors).forEach(([key, value]) => {
                const name = key.replace('--', '').replace(/-color$/, '');
                normalizedColors[name] = value;
            });

            themes.generateThemeVariants(normalizedColors);
        },
        hexToHSL(hex) {
            let r = 0, g = 0, b = 0;
            hex = hex.replace('#', '');

            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            }

            r /= 255;
            g /= 255;
            b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0, l = (max + min) / 2;

            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
                case g: h = ((b - r) / d + 2); break;
                case b: h = ((r - g) / d + 4); break;
                }
                h /= 6;
            }

            h = Math.round(h * 360);
            s = Math.round(s * 100);
            l = Math.round(l * 100);

            return { h, s, l };
        },

        hslToCSS({ h, s, l }) {
            return `hsl(${h}, ${s}%, ${l}%)`;
        },

        generateColorVariants(name, hexColor, target = document.documentElement) {
            const hsl = themes.hexToHSL(hexColor);
            const variants = {
                [`--${name}-lightest`]: themes.hslToCSS({ ...hsl, l: Math.min(hsl.l + 40, 100) }),
                [`--${name}-lighter`]:  themes.hslToCSS({ ...hsl, l: Math.min(hsl.l + 20, 100) }),
                [`--${name}`]:          themes.hslToCSS(hsl),
                [`--${name}-darker`]:   themes.hslToCSS({ ...hsl, l: Math.max(hsl.l - 20, 10) }),
                [`--${name}-darkest`]:  themes.hslToCSS({ ...hsl, l: Math.max(hsl.l - 40, 0) }),
                [`--${name}-text`]:     hsl.l > 60 ? '#000000' : '#ffffff',
                [`--${name}-border`]:   themes.hslToCSS({ ...hsl, l: hsl.l > 50 ? hsl.l - 30 : hsl.l + 30 })
            };

            Object.entries(variants).forEach(([key, value]) => {
                target.style.setProperty(key, value);
            });
        },

        generateThemeVariants(baseColors) {
            const root = document.documentElement;
            Object.entries(baseColors).forEach(([name, hex]) => {
                themes.generateColorVariants(name, hex, root);
            });
        },

        getCSSVariables(...vars) {
            const styles = getComputedStyle(document.documentElement);
            const result = {};
            vars.forEach((v) => {
                result[v] = styles.getPropertyValue(v).trim();
            });
            return result;
        }
    }
}

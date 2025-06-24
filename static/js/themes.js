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
            if (!name || typeof hexColor !== 'string' || !hexColor.startsWith('#')) {
                console.warn(`generateColorVariants: Nome inválido ou cor hex inválida (${hexColor})`);
                return;
            }

            const hsl = themes.hexToHSL(hexColor);
            if (!hsl) {
                console.warn(`generateColorVariants: Falha ao converter HEX para HSL: ${hexColor}`);
                return;
            }

            const clamp = (value) => Math.max(0, Math.min(100, value));

            // Define a função para gerar os H, S, L de uma variação
            const setHSLVars = (variantName, h, s, l) => {
                target.style.setProperty(`--${variantName}-H`, `${h}`);
                target.style.setProperty(`--${variantName}-S`, `${s}%`);
                target.style.setProperty(`--${variantName}-L`, `${l}%`);
            };

            // Cor base
            setHSLVars(name, hsl.h, hsl.s, hsl.l);
            target.style.setProperty(`--${name}`, `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`);

            // Variações
            const variations = [
                { suffix: 'lighter',  l: clamp(hsl.l + 20) },
                { suffix: 'lightest', l: clamp(hsl.l + 40) },
                { suffix: 'darker',   l: clamp(hsl.l - 5) },
                { suffix: 'darkest',  l: clamp(hsl.l - 10) },
                { suffix: 'border',   l: clamp(85) }
            ];

            variations.forEach(variant => {
                const variantName = `${name}-${variant.suffix}`;
                setHSLVars(variantName, hsl.h, hsl.s, variant.l);
                target.style.setProperty(`--${variantName}`, `hsl(${hsl.h} ${hsl.s}% ${variant.l}%)`);
            });

            // Texto (com base na cor base)
            target.style.setProperty(`--${name}-text`, hsl.l > 60 ? 'var(--black)' : 'var(--white)');

            // Alpha
            target.style.setProperty(`--${name}-half-alpha`, `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.5)`);
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

// Configurações internacionalização
function Translations() {
    return {
        async init() {
            // Internacionalização: Carrega idioma salvo ou padrão
            const savedLang = localStorage.getItem('lang') || 'pt-BR';
            document.getElementById('data-lang').value = savedLang;

            const response = await fetch(`/static/i18n/${savedLang}.json`);
            translations = await response.json();
            currentLang = savedLang;
            translate.applyTranslations();
            global.currentLang = savedLang;
            localStorage.setItem('lang', savedLang);
        },

        applyTranslations() {
            document.querySelectorAll('[data-i18n]').forEach(translate._getTranslation);
            const translatorObserver = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.hasAttribute('data-i18n')) translate._getTranslation(node);
                            node.querySelectorAll?.('[data-i18n]').forEach(translate._getTranslation);
                        };
                    };
                };
            });

            translatorObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        },

        _getTranslation(el) {
            const key = el.getAttribute('data-i18n');
            const text = translate._translate(key);
            if (text) el.textContent = text;
        },

        _translationsAvaliable: () => {
            try {
                if(translations && window.translations) return true;
            } catch { return false };
        },

        _translate(message, params = []) {
            if(!translate._translationsAvaliable()) return message;
            const text = message.split('.').reduce((o, i) => o?.[i], translations);
            let result = !!text && text !== '' ? text : message;

            if (params && params.length > 0) {
                result = result.replace(/\{(\d+)\}/g, (match, index) => {
                    return params[index] !== undefined ? params[index] : match;
                });
            };

            return result;
        }

    };
};

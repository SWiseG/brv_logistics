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
            localStorage.setItem('lang', savedLang);
        },

        applyTranslations() {
            document.querySelectorAll('[data-i18n]').forEach(translate._translate);
            const translatorObserver = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.hasAttribute('data-i18n')) translate._translate(node);
                            node.querySelectorAll?.('[data-i18n]').forEach(translate._translate);
                        };
                    };
                };
            });

            translatorObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        },

        _translate(el) {
            const key = el.getAttribute('data-i18n');
            const text = key.split('.').reduce((o, i) => o?.[i], translations);
            if (text) el.textContent = text;
        }

    };
};

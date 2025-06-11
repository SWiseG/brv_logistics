// Configurações globais
function Global() {
    return {
        toasts: [],
        translations: {},
        currentLang: 'pt-BR',
        cart: {
            items: [],
            total: 0
        },
        config: {
            currency: 'BRL',
            currencySymbol: 'R$',
            apiUrl: '/api/',
            csrfToken: document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
        },
        initHtml: () => {
            $('html').removeClass('hidden-content-html');
        },
    }
};
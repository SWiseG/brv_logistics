// Utilitários
function Utils() {
    return {
        // Formatar preço
        formatPrice: function(price, currency = 'BRL', locale = global?.currentLang || 'pt-BR') {
            if (typeof price !== 'number' || isNaN(price)) {
                // if(window['logger']) logger.log('Invalid price:', price, 'warn');
                // if(window['logger']) logger.log('Trying to parse price', 'warn');
                price = parseFloat(price);
                if (typeof price !== 'number' || isNaN(price)) return 'R$ 0,00';
                // if(window['logger']) logger.log('Price parsed successfuly', 'success');
            }

            try {
                return new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: currency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(price);
            } catch (e) {
                console.error('Erro ao formatar preço:', e);
                return price.toString();
            }
        },

        // Formatar CEP
        formatCEP: function(cep) {
            return cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
        },

        // Formatar telefone
        formatPhone: function(phone) {
            return phone.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        },

        // Formatar CPF
        formatCPF: function(cpf) {
            return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        },

        // Debounce para otimizar performance
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        // Loading
        loading: function(action=true) {
            var loading = document.getElementById('global-loader');
            if(!action || (action === true && $(loading).hasClass('show'))) {
                $(loading).removeClass('show');
            }
            else $(loading).addClass('show');
        },

        // Loading content
        showLoading: function(element) {
            const originalContent = element.innerHTML;
            element.innerHTML = '<span class="loading"></span> Carregando...';
            element.disabled = true;
            
            return function hideLoading() {
                element.innerHTML = originalContent;
                element.disabled = false;
            };
        },

        // Confirmation Modal
        onConfirmationModal: (params, callbackSuccess, e=null) => {
            if(e) {
                e.preventDefault();
                e.stopPropagation();
            };
            return modal.open({ view: 'Confirmation', params})
                    .then(result => {
                        if(e) {
                            e.preventDefault();
                            e.stopPropagation();
                        };
                        return callbackSuccess(result, params, e);
                    }).catch(err => {
                        if(window['logger']) logger.log('Confirmation modal resolve with errors: ' + err, 'error');
                        return false;
                    });
        },

        // Aux. Dropdown
        openCloseDropdown: (dropdownId, status=true) => {
            const $dropdown = $(`#${dropdownId}`);
            if($dropdown && $dropdown.length > 0) {
                const dropdownConfig = bootstrap.Dropdown.getInstance($dropdown[0]);
                if(dropdownConfig) {
                    if(status) dropdownConfig.show();
                    else dropdownConfig.hide();
                    return true;
                };
            }; 
            return false;
        },

        isDropdownOpened: (dropdownId) => {
            const $dropdown = $(`#${dropdownId}`);
            if($dropdown && $dropdown.length > 0) {
                const dropdownConfig = bootstrap.Dropdown.getInstance($dropdown[0]);
                if(dropdownConfig) {
                    const $dropdownMenu = $dropdown.siblings('[role="dropdown-menu"]');
                    if($dropdownMenu && $dropdownMenu.length > 0 && $dropdownMenu.hasClass('show')) return true;
                };
            }; 
            return false;
        },
    };
}
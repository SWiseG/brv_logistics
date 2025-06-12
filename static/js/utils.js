// Utilitários
function Utils() {
    return {
        // Formatar preço
        formatPrice: function(price) {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(price);
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
        }
    };
}
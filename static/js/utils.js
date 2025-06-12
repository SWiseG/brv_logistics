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

        // Mostrar notificação
        notify: function(message, type = 'success') {
            var close = (toast) => {
                toast.classList.remove("show");
                toast.classList.add("hide");

                toast.addEventListener("transitionend", () => {
                    remove(toast);
                }, { once: true });
            }

            var remove = (toast) => {
                const index = global.toasts.indexOf(toast);
                if (index !== -1) {
                    global.toasts.splice(index, 1);
                    toast.remove();
                    recalculate();
                }
            }

            var recalculate = () => {
                let offset = 0;
                global.toasts.forEach((toast, index) => {
                    toast.style.top = `${offset}px`;
                    offset += toast.offsetHeight + 10; // espaço entre global.toasts
                });
            }
            const toast = document.createElement("div");
            toast.className = `notification ${type}`;
            toast.innerText = message;

            // Adiciona ao DOM
            var toastContainer = document.getElementById("notification-container");
            toastContainer.appendChild(toast);
            global.toasts.push(toast);

            // Recalcula posições
            recalculate();

            // Trigger entrada (deixar o browser "sentir" o appendChild primeiro)
            setTimeout(() => {
                toast.classList.add("show");

                // Fecha após 10 segundos
                setTimeout(() => close(toast), 10000);

                // Clique para fechar
                toast.addEventListener("click", () => close(toast));
            }, 10);


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
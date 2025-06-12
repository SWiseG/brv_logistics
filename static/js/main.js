// Gerenciamento do Carrinho
const Cart = {
    // Adicionar item ao carrinho
    addItem: function(productId, quantity = 1, variant = null) {
        const hideLoading = utils.showLoading(document.querySelector(`[data-product-id="${productId}"] .btn-add-cart`));
        
        fetch('/cart/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': global.config.csrfToken
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity,
                variant: variant
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                utils.notify('Produto adicionado ao carrinho!', 'success');
                this.updateCartCount(data.cart_count);
                this.updateCartTotal(data.cart_total);
            } else {
                utils.notify(data.message || 'Erro ao adicionar produto', 'error');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            utils.notify('Erro ao adicionar produto ao carrinho', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    },

    // Remover item do carrinho
    removeItem: function(itemId) {
        if (!confirm('Tem certeza que deseja remover este item?')) {
            return;
        }

        fetch('/cart/remove/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': global.config.csrfToken
            },
            body: JSON.stringify({
                item_id: itemId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                utils.notify('Item removido do carrinho', 'success');
                location.reload(); // Recarregar página para atualizar carrinho
            } else {
                utils.notify(data.message || 'Erro ao remover item', 'error');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            utils.notify('Erro ao remover item do carrinho', 'error');
        });
    },

    // Atualizar quantidade
    updateQuantity: function(itemId, quantity) {
        if (quantity < 1) {
            this.removeItem(itemId);
            return;
        }

        fetch('/cart/update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': global.config.csrfToken
            },
            body: JSON.stringify({
                item_id: itemId,
                quantity: quantity
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.updateCartTotal(data.cart_total);
                // Atualizar subtotal do item
                const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
                if (itemElement) {
                    const subtotalElement = itemElement.querySelector('.item-subtotal');
                    if (subtotalElement) {
                        subtotalElement.textContent = utils.formatPrice(data.item_subtotal);
                    }
                }
            } else {
                utils.notify(data.message || 'Erro ao atualizar quantidade', 'error');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            utils.notify('Erro ao atualizar carrinho', 'error');
        });
    },

    // Atualizar contador do carrinho
    updateCartCount: function(count) {
        const cartCountElements = document.querySelectorAll('.cart-count');
        cartCountElements.forEach(element => {
            element.textContent = count;
            element.style.display = count > 0 ? 'inline' : 'none';
        });
    },

    // Atualizar total do carrinho
    updateCartTotal: function(total) {
        const cartTotalElements = document.querySelectorAll('.cart-total');
        cartTotalElements.forEach(element => {
            element.textContent = utils.formatPrice(total);
        });
    }
};

// Validação de formulários
const FormValidation = {
    init: function() {
        const forms = document.querySelectorAll('.needs-validation');
        forms.forEach(form => {
            form.addEventListener('submit', this.handleSubmit.bind(this));
        });

        // Validação em tempo real
        const inputs = document.querySelectorAll('input[required], select[required], textarea[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', this.validateField.bind(this));
            input.addEventListener('input', this.clearErrors.bind(this));
        });
    },

    handleSubmit: function(event) {
        const form = event.target;
        if (!form.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
            this.showErrors(form);
        }
        form.classList.add('was-validated');
    },

    validateField: function(event) {
        const field = event.target;
        const isValid = field.checkValidity();
        
        if (!isValid) {
            this.showFieldError(field);
        } else {
            this.clearFieldError(field);
        }
    },

    showFieldError: function(field) {
        const errorElement = field.parentNode.querySelector('.invalid-feedback');
        if (errorElement) {
            errorElement.textContent = field.validationMessage;
        }
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
    },

    clearFieldError: function(field) {
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
    },

    clearErrors: function(event) {
        const field = event.target;
        if (field.classList.contains('is-invalid')) {
            field.classList.remove('is-invalid');
        }
    },

    showErrors: function(form) {
        const invalidFields = form.querySelectorAll(':invalid');
        invalidFields.forEach(field => {
            this.showFieldError(field);
        });
    }
};

// CEP e endereço
const AddressHelper = {
    init: function() {
        const cepInputs = document.querySelectorAll('input[data-cep]');
        cepInputs.forEach(input => {
            input.addEventListener('blur', this.searchCEP.bind(this));
            input.addEventListener('input', this.formatCEP.bind(this));
        });
    },

    formatCEP: function(event) {
        const input = event.target;
        input.value = utils.formatCEP(input.value);
    },

    searchCEP: function(event) {
        const input = event.target;
        const cep = input.value.replace(/\D/g, '');
        
        if (cep.length !== 8) return;

        const hideLoading = utils.showLoading(input);

        fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(response => response.json())
        .then(data => {
            if (data.erro) {
                utils.notify('CEP não encontrado', 'warning');
                return;
            }

            this.fillAddressFields(data);
        })
        .catch(error => {
            console.error('Erro ao buscar CEP:', error);
            utils.notify('Erro ao buscar CEP', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    },

    fillAddressFields: function(data) {
        const fields = {
            'street': data.logradouro,
            'neighborhood': data.bairro,
            'city': data.localidade,
            'state': data.uf
        };

        Object.keys(fields).forEach(fieldName => {
            const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
            if (field && fields[fieldName]) {
                field.value = fields[fieldName];
                field.dispatchEvent(new Event('input'));
            }
        });
    }
};

// Galeria de imagens
const ImageGallery = {
    init: function() {
        const thumbnails = document.querySelectorAll('.product-thumbnail');
        const mainImage = document.querySelector('.product-main-image');
        
        if (!mainImage) return;

        thumbnails.forEach(thumbnail => {
            thumbnail.addEventListener('click', function(e) {
                e.preventDefault();
                const newSrc = this.getAttribute('data-image');
                const newAlt = this.getAttribute('alt');
                
                mainImage.src = newSrc;
                mainImage.alt = newAlt;
                
                // Atualizar thumbnail ativo
                thumbnails.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Zoom na imagem
        this.initImageZoom(mainImage);
    },

    initImageZoom: function(image) {
        image.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            this.style.transformOrigin = `${x}% ${y}%`;
            this.style.transform = 'scale(2)';
        });

        image.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    }
};

// Avaliações
const Reviews = {
    init: function() {
        const ratingInputs = document.querySelectorAll('.rating-input');
        ratingInputs.forEach(input => {
            input.addEventListener('change', this.updateRatingDisplay.bind(this));
        });

        const reviewForm = document.querySelector('#reviewForm');
        if (reviewForm) {
            reviewForm.addEventListener('submit', this.submitReview.bind(this));
        }
    },

    updateRatingDisplay: function(event) {
        const rating = event.target.value;
        const stars = event.target.parentNode.querySelectorAll('.fa-star');
        
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('text-warning');
                star.classList.remove('text-muted');
            } else {
                star.classList.add('text-muted');
                star.classList.remove('text-warning');
            }
        });
    },

    submitReview: function(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        
        const hideLoading = utils.showLoading(submitButton);

        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': global.config.csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                utils.notify('Avaliação enviada com sucesso!', 'success');
                form.reset();
                // Recarregar seção de avaliações
                location.reload();
            } else {
                utils.notify(data.message || 'Erro ao enviar avaliação', 'error');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            utils.notify('Erro ao enviar avaliação', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }
};

// Lista de desejos
const Wishlist = {
    toggle: function(productId) {
        const button = document.querySelector(`[data-wishlist-product="${productId}"]`);
        const icon = button.querySelector('i');
        
        fetch('/wishlist/toggle/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': global.config.csrfToken
            },
            body: JSON.stringify({
                product_id: productId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.added) {
                    icon.classList.remove('far');
                    icon.classList.add('fas', 'text-danger');
                    utils.notify('Produto adicionado à lista de desejos', 'success');
                } else {
                    icon.classList.remove('fas', 'text-danger');
                    icon.classList.add('far');
                    utils.notify('Produto removido da lista de desejos', 'success');
                }
            } else {
                utils.notify(data.message || 'Erro ao atualizar lista de desejos', 'error');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            utils.notify('Erro ao atualizar lista de desejos', 'error');
        });
    }
};

// Instalando require
window.require = (scripts, callback) => {
    if(!scripts || "" === scripts) return false;
    scripts = String(scripts).split(',');

    const define = (src) => {
        return new Promise((resolve, reject) => {
            src = src.trim();
            if(!src || "" === src) return false;
            if(!src.startsWith('/static/')) src = `/static/js/${src}`;
            if(!src.endsWith('js')) src = `${src}.js`;

            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = true;

            script.onload = () => resolve(src);
            script.onerror = () => reject(new Error(`Failed to load module: ${src}`));

            document.head.appendChild(script);
        });
    };

    Promise.all(scripts.map(define))
        .then((srcs) => {
            srcs.forEach(scriptName => {
                console.log(`Success to load module: ${scriptName}`);
            });
            if (typeof callback === 'function') callback();
        })
        .catch((error) => {
            console.error(error);
        });
}

// Main
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar módulos
    await require('global, utils, bindings, themes, translation', async (res) => {
        // Global
        window.global = new Global();

        // Bindings
        bindings.init();

        // Utils
        window.utils = new Utils();
        utils.loading();

        // Themes
        window.themes = new Themes();
        await themes.initTheme();

        // Translation
        window.translate = new Translations();
        translate.init();

        // Navbar
        if(undefined !== Navbar && typeof Navbar === 'function') {
            window.navBar = new Navbar();
            navBar.init();
        };

        // Finally
        global.initHtml();
        utils.loading(false);
    });

    FormValidation.init();
    AddressHelper.init();
    ImageGallery.init();
    Reviews.init();

    // Event listeners globais
    // Adicionar ao carrinho
    document.addEventListener('click', function(e) {
        if (e.target.matches('.btn-add-cart') || e.target.closest('.btn-add-cart')) {
            e.preventDefault();
            const button = e.target.closest('.btn-add-cart');
            const productId = button.getAttribute('data-product-id');
            const quantity = button.getAttribute('data-quantity') || 1;
            const variant = button.getAttribute('data-variant') || null;
            
            Cart.addItem(productId, parseInt(quantity), variant);
        }
    });

    // Remover do carrinho
    document.addEventListener('click', function(e) {
        if (e.target.matches('.btn-remove-cart') || e.target.closest('.btn-remove-cart')) {
            e.preventDefault();
            const button = e.target.closest('.btn-remove-cart');
            const itemId = button.getAttribute('data-item-id');
            
            Cart.removeItem(itemId);
        }
    });

    // Atualizar quantidade no carrinho
    document.addEventListener('change', function(e) {
        if (e.target.matches('.cart-quantity-input')) {
            const input = e.target;
            const itemId = input.getAttribute('data-item-id');
            const quantity = parseInt(input.value);
            
            Cart.updateQuantity(itemId, quantity);
        }
    });

    // Toggle lista de desejos
    document.addEventListener('click', function(e) {
        if (e.target.matches('.btn-wishlist') || e.target.closest('.btn-wishlist')) {
            e.preventDefault();
            const button = e.target.closest('.btn-wishlist');
            const productId = button.getAttribute('data-wishlist-product');
            
            Wishlist.toggle(productId);
        }
    });

    // Máscaras de input
    document.addEventListener('input', function(e) {
        const input = e.target;
        
        if (input.matches('[data-mask="phone"]')) {
            input.value = utils.formatPhone(input.value);
        } else if (input.matches('[data-mask="cpf"]')) {
            input.value = utils.formatCPF(input.value);
        } else if (input.matches('[data-mask="cep"]')) {
            input.value = utils.formatCEP(input.value);
        }
    });

    // Smooth scroll para âncoras
    document.addEventListener('click', function(e) {
        if (e.target.matches('a[href^="#"]')) {
            e.preventDefault();
            const target = document.querySelector(e.target.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });

    // Lazy loading para imagens
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // Inicializar tooltips do Bootstrap
    if (typeof $ !== 'undefined' && $.fn.tooltip) {
        $('[data-toggle="tooltip"]').tooltip();
    }

    // Inicializar popovers do Bootstrap
    if (typeof $ !== 'undefined' && $.fn.popover) {
        $('[data-toggle="popover"]').popover();
    }

});

// Exportar para uso global
window.Cart = Cart;
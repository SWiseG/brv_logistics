// ================================
// NAVBAR JAVASCRIPT - FUNCIONALIDADES COMPLETAS
// ================================

class NavbarManager {
    constructor() {
        this.searchTimeout = null;
        this.searchMinLength = 2;
        this.isSearching = false;
        this.currentSuggestionIndex = -1;
        
        this.init();
    }
    
    init() {
        this.initCartDropdown();
        this.initMobileNav();
        this.initCountUpdates();
        this.initEventListeners();
        this.loadCartDropdown();
    }
    
    // ================================
    // CARRINHO DROPDOWN
    // ================================
    initCartDropdown() {
        const cartDropdown = document.getElementById('cartDropdown');
        
        if (!cartDropdown) return;
        
        // Carregar conteúdo quando abrir o dropdown
        cartDropdown.addEventListener('show.bs.dropdown', () => {
            this.loadCartDropdown();
        });
    }
    
    async loadCartDropdown() {
        const cartDropdownContent = document.getElementById('cartDropdownContent');
        
        if (!cartDropdownContent) return;
        
        try {
            // Mostrar loading
            cartDropdownContent.innerHTML = `
                <div class="text-center p-3">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                </div>
            `;
            
            const response = await fetch('/navbar/cart/dropdown/');
            const data = await response.json();
            
            if (data.html) {
                cartDropdownContent.innerHTML = data.html;
                
                // Atualizar contador do carrinho
                this.updateCartCount(data.total_items);
            }
            
        } catch (error) {
            console.error('Erro ao carregar carrinho:', error);
            cartDropdownContent.innerHTML = `
                <div class="text-center p-3 text-muted">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Erro ao carregar carrinho
                </div>
            `;
        }
    }
    
    // ================================
    // NAVEGAÇÃO MOBILE
    // ================================
    initMobileNav() {
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        const mobileNav = document.getElementById('mobileNav');
        const mobileNavClose = document.querySelector('.mobile-nav-close');
        const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
        
        if (!mobileMenuToggle || !mobileNav) return;
        
        // Abrir menu mobile
        mobileMenuToggle.addEventListener('click', () => {
            mobileNav.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        // Fechar menu mobile
        const closeMobileNav = () => {
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        };
        
        if (mobileNavClose) {
            mobileNavClose.addEventListener('click', closeMobileNav);
        }
        
        if (mobileNavOverlay) {
            mobileNavOverlay.addEventListener('click', closeMobileNav);
        }
        
        // Fechar ao pressionar ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                closeMobileNav();
            }
        });
        
        // Submenu mobile
        this.initMobileSubmenus();
    }
    
    initMobileSubmenus() {
        const categoryItems = document.querySelectorAll('.mobile-category-item');
        
        categoryItems.forEach(item => {
            const categoryLink = item.querySelector('a');
            const subcategories = item.querySelector('.mobile-subcategories');
            
            if (!categoryLink || !subcategories) return;
            
            const chevron = categoryLink.querySelector('.fa-chevron-down');
            
            if (chevron) {
                categoryLink.addEventListener('click', (e) => {
                    // Se clicou no chevron, prevenir navegação
                    if (e.target.closest('.fa-chevron-down')) {
                        e.preventDefault();
                        
                        const isOpen = subcategories.style.display === 'block';
                        
                        // Fechar todos os outros submenus
                        document.querySelectorAll('.mobile-subcategories').forEach(sub => {
                            sub.style.display = 'none';
                        });
                        
                        document.querySelectorAll('.fa-chevron-down').forEach(chev => {
                            chev.classList.remove('fa-chevron-up');
                            chev.classList.add('fa-chevron-down');
                        });
                        
                        // Toggle do submenu atual
                        if (!isOpen) {
                            subcategories.style.display = 'block';
                            chevron.classList.remove('fa-chevron-down');
                            chevron.classList.add('fa-chevron-up');
                        }
                    }
                });
            }
        });
    }
    
    // ================================
    // ATUALIZAÇÃO DE CONTADORES
    // ================================
    initCountUpdates() {
        // Atualizar contadores a cada 30 segundos (opcional)
        setInterval(() => {
            this.updateAllCounts();
        }, 30000);
    }
    
    async updateAllCounts() {
        await Promise.all([
            this.updateCartCountFromServer(),
            this.updateWishlistCountFromServer()
        ]);
    }
    
    async updateCartCountFromServer() {
        try {
            const response = await fetch('/navbar/cart/count/');
            const data = await response.json();
            this.updateCartCount(data.cart_count);
        } catch (error) {
            console.error('Erro ao atualizar contador do carrinho:', error);
        }
    }
    
    async updateWishlistCountFromServer() {
        try {
            const response = await fetch('/navbar/wishlist/count/');
            const data = await response.json();
            this.updateWishlistCount(data.wishlist_count);
        } catch (error) {
            console.error('Erro ao atualizar contador da wishlist:', error);
        }
    }
    
    updateCartCount(count) {
        const cartCountElements = document.querySelectorAll('#cartCount');
        cartCountElements.forEach(element => {
            element.textContent = count || 0;
            
            // Adicionar animação
            element.classList.add('animate-bounce');
            setTimeout(() => {
                element.classList.remove('animate-bounce');
            }, 600);
        });
    }
    
    updateWishlistCount(count) {
        const wishlistCountElements = document.querySelectorAll('#wishlistCount');
        wishlistCountElements.forEach(element => {
            element.textContent = count || 0;
            
            // Adicionar animação
            element.classList.add('animate-bounce');
            setTimeout(() => {
                element.classList.remove('animate-bounce');
            }, 600);
        });
    }
    
    // ================================
    // EVENT LISTENERS GERAIS
    // ================================
    initEventListeners() {
        // Scroll para fixar navbar
        this.initStickyNavbar();
        
        // Adicionar ao carrinho via AJAX
        this.initAddToCartButtons();
        
        // Newsletter
        this.initNewsletter();
    }
    
    initStickyNavbar() {
        const mainHeader = document.querySelector('.main-header');
        
        if (!mainHeader) return;
        
        let lastScrollTop = 0;
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > 100) {
                mainHeader.classList.add('navbar-scrolled');
            } else {
                mainHeader.classList.remove('navbar-scrolled');
            }
            
            // Hide/show navbar on scroll (opcional)
            if (scrollTop > lastScrollTop && scrollTop > 200) {
                mainHeader.style.transform = 'translateY(-100%)';
            } else {
                mainHeader.style.transform = 'translateY(0)';
            }
            
            lastScrollTop = scrollTop;
        });
    }
    
    initAddToCartButtons() {
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.btn-add-to-cart')) {
                e.preventDefault();
                
                const button = e.target.closest('.btn-add-to-cart');
                const productId = button.dataset.productId;
                const variantId = button.dataset.variantId;
                const quantity = button.dataset.quantity || 1;
                
                await this.addToCart(productId, variantId, quantity, button);
            }
        });
    }
    
    async addToCart(productId, variantId, quantity, button) {
        const originalText = button.innerHTML;
        
        try {
            // Mostrar loading
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adicionando...';
            button.disabled = true;
            
            const formData = new FormData();
            formData.append('product_id', productId);
            if (variantId) formData.append('variant_id', variantId);
            formData.append('quantity', quantity);
            
            // Adicionar CSRF token
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
            if (csrfToken) {
                formData.append('csrfmiddlewaretoken', csrfToken.value);
            }
            
            const response = await fetch('/pedidos/carrinho/adicionar/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Sucesso
                button.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
                button.classList.remove('btn-primary');
                button.classList.add('btn-success');
                
                // Atualizar contador do carrinho
                this.updateCartCount(data.cart_count);
                
                // Mostrar toast de sucesso
                this.showToast('Produto adicionado ao carrinho!', 'success');
                
                // Voltar ao estado original após 2 segundos
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('btn-success');
                    button.classList.add('btn-primary');
                    button.disabled = false;
                }, 2000);
                
            } else {
                throw new Error(data.message || 'Erro ao adicionar produto');
            }
            
        } catch (error) {
            console.error('Erro ao adicionar ao carrinho:', error);
            
            button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro';
            button.classList.add('btn-danger');
            
            this.showToast('Erro ao adicionar produto ao carrinho', 'error');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('btn-danger');
                button.classList.add('btn-primary');
                button.disabled = false;
            }, 2000);
        }
    }
    
    initNewsletter() {
        const newsletterForm = document.querySelector('.newsletter-form');
        
        if (!newsletterForm) return;
        
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            const button = newsletterForm.querySelector('button');
            const originalText = button.innerHTML;
            
            try {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                button.disabled = true;
                
                const formData = new FormData();
                formData.append('email', emailInput.value);
                
                const response = await fetch('/marketing/newsletter/subscribe/', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showToast('E-mail cadastrado com sucesso!', 'success');
                    emailInput.value = '';
                } else {
                    throw new Error(data.message);
                }
                
            } catch (error) {
                this.showToast('Erro ao cadastrar e-mail', 'error');
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        });
    }
    
    // ================================
    // UTILITÁRIOS
    // ================================
    showToast(message, type = 'info') {
        // Criar toast se não existir
        if (!document.getElementById('toastContainer')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        const toastContainer = document.getElementById('toastContainer');
        
        const toastId = 'toast_' + Date.now();
        const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-primary';
        
        const toastHTML = `
            <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
                <div class="toast-body">
                    <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'} me-2"></i>
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 4000
        });
        
        toast.show();
        
        // Remover elemento após esconder
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
    
    // Método público para atualizar contadores externamente
    static updateCartCount(count) {
        if (window.navbarManager) {
            window.navbarManager.updateCartCount(count);
        }
    }
    
    static updateWishlistCount(count) {
        if (window.navbarManager) {
            window.navbarManager.updateWishlistCount(count);
        }
    }
}

// ================================
// INICIALIZAÇÃO
// ================================
document.addEventListener('DOMContentLoaded', () => {
    window.navbarManager = new NavbarManager();
});

// CSS adicional para animações (adicionar ao seu CSS)
const additionalCSS = `
.animate-bounce {
    animation: bounce 0.6s ease-in-out;
}

@keyframes bounce {
    0%, 20%, 60%, 100% {
        transform: translateY(0);
    }
    40% {
        transform: translateY(-10px);
    }
    80% {
        transform: translateY(-5px);
    }
}

.navbar-scrolled {
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
}

.search-suggestions {
    max-height: 400px;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.suggestion-item:hover,
.suggestion-item.active {
    background-color: #f8f9fa !important;
}

.mobile-nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    visibility: hidden;
    opacity: 0;
    transition: all 0.3s ease;
}

.mobile-nav.active {
    visibility: visible;
    opacity: 1;
}

.mobile-nav-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
}

.mobile-nav-content {
    position: absolute;
    top: 0;
    right: 0;
    width: 300px;
    height: 100%;
    max-width: 80vw;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    overflow-y: auto;
}

.mobile-nav.active .mobile-nav-content {
    transform: translateX(0);
}

.mobile-subcategories {
    display: none;
}

.cart-dropdown {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.mega-menu {
    min-width: 600px;
}

@media (max-width: 768px) {
    .mega-menu {
        min-width: auto;
        width: 100vw;
        left: 0 !important;
        transform: none !important;
    }
}
`;

// Adicionar CSS ao documento
if (!document.getElementById('navbar-styles')) {
    const style = document.createElement('style');
    style.id = 'navbar-styles';
    style.textContent = additionalCSS;
    document.head.appendChild(style);
}

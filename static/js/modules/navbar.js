define(`/static/js/modules/navbar.js`, [`/static/js/mixins/data.source.js`], 
    function Navbar() {
        return {
            name: `NavBar`,
            kind: bindings.observable(`module`),
            modules: bindings.observable(null),
            
            searchTimeout: bindings.observable(null),
            searchMinLength: bindings.observable(2),
            isSearching: bindings.observable(false),
            currentSuggestionIndex: bindings.observable(-1),
            
            cartCount: bindings.observable(0),
            cartTotal: bindings.observable(0),
            cartItems: bindings.observable([]),
            cartDropdownLoaded: bindings.observable(false),

            wishlistCount: bindings.observable(0),
            wishlistItems: bindings.observableArray([]),
            wishlistDropdownLoaded: bindings.observable(false),
            
            userLocation: bindings.observable(''),

            isLoading: bindings.observable(false),
            isCartLoading: bindings.observable(false),
            isWishlistLoading: bindings.observable(false),

            config: {
                cartUpdateAnimationDuration: 600,
                wishlistToggleAnimationDuration: 400,
                maxCartPreview: 5,
                maxWishlistPreview: 5
            },

            compositionComplete: async (name, path, dependencies, callback, params) => {
                try {
                    await ctor.initializeNavComponents();
                    await ctor.loadInitialData();
                    ctor.setupEventNavListeners();
                    ctor.applySubscribers();
                    
                    return bindings.reload();
                } catch (error) {
                    console.error('Error initializing navbar:', error);
                }
            },

            updateCartTotal: () => {
                const items = ctor.cartItems();
                const total = utils.formatPrice(items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0));
                ctor.cartTotal(total);
            },

            applySubscribers: () => {
                ctor.cartCount.subscribe((newCount) => {
                    ctor.animateCounter('cart');
                });
                
                ctor.cartItems.subscribe((newItems) => {
                    ctor.updateCartTotal();
                });
                
                ctor.wishlistCount.subscribe((newCount) => {
                    ctor.animateCounter('wishlist');
                });
                
                ctor.isLoading.subscribe((loading) => {
                    utils.loading(loading);
                });
            },

            initializeNavComponents: async () => {
                // Inicializar busca
                ctor.initSearch();
                
                // Inicializar carrinho
                ctor.initializeCart();
                
                // Inicializar wishlist
                ctor.initializeWishlist();
                
                // Inicializar animações
                ctor.initializeAnimations();
            },

            loadInitialData: async () => {
                if (global.user.isAuthenticated) {
                    // Carregar dados iniciais em paralelo
                    await Promise.allSettled([
                        ctor.loadCart(true),
                        ctor.loadWishlist(true)
                    ]);
                }
            },

            setupEventNavListeners: () => {
                // // Global click handler
                // document.addEventListener('click', ctor.handleGlobalClick);
                
                // // Keyboard shortcuts
                // document.addEventListener('keydown', ctor.handleKeyboardShortcuts);
                
                // // Window resize
                // window.addEventListener('resize', ctor.handleWindowResize);
                
                // // Page visibility para atualizar contadores
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) {
                        ctor.reloadModules();
                    }
                });
            },

            reloadModules: async () => {
                if (!global.user.isAuthenticated) return;
                
                try {
                    await Promise.all([
                        ctor.loadCart(true),
                        ctor.loadWishlist(true)
                    ]);
                    
                    ctor.cartDropdownLoaded(false);
                    ctor.wishlistDropdownLoaded(false);
                    
                } catch (error) {
                    console.error('Erro ao atualizar contadores:', error);
                }
            },
            
            animateCounter: (type) => {
                const selector = type === 'cart' ? '.navbar-badge' : '.navbar-badge';
                const elements = document.querySelectorAll(selector);
                
                elements.forEach(element => {
                    if (element.closest(`#${type}Dropdown`)) {
                        element.classList.add('animate-bounce');
                        setTimeout(() => element.classList.remove('animate-bounce'), 600);
                    }
                });
            },

            loadSubNavbarRow: () => {
                var $subNav = $('subnav');
                if ($subNav && $subNav.length > 0) {
                    var $next = $subNav.find('#subnav-scroll-arrow-left');
                    var $previous = $subNav.find('#subnav-scroll-arrow-right');
                    var $containerList = $subNav.find('.subnav-controll-list');

                    let scrollInterval;

                    if ($next?.length > 0 && $previous?.length > 0 && $containerList?.length > 0) {
                        const container = $containerList[0];

                        function reloadArrows() {
                            const overflow = container.scrollWidth > container.clientWidth;
                            $previous[0].style.display = $next[0].style.display = overflow ? 'block' : 'none';
                        }

                        function startScroll(direction) {
                            stopScroll();
                            scrollInterval = setInterval(() => {
                                container.scrollBy({
                                    left: direction === 'left' ? -80 : 80,
                                    behavior: 'smooth'
                                });
                            }, 100);
                        }

                        function stopScroll() {
                            if (scrollInterval) {
                                clearInterval(scrollInterval);
                                scrollInterval = null;
                            }
                        }

                        $next.on("mouseenter", () => startScroll('left'));
                        $previous.on("mouseenter", () => startScroll('right'));

                        $next.on("mouseleave", stopScroll);
                        $previous.on("mouseleave", stopScroll);

                        $(window).on("resize", reloadArrows);
                        $(window).on("load", reloadArrows);

                        reloadArrows();
                    }
                }
            },

            onAddress: () => {
                event.preventDefault();
                modal.open({
                    view: 'Login'
                }).then(result => {
                    console.log('Resultado do modal:', result);
                }).catch(err => {
                    console.warn('Modal cancelado:', err);
                });
            },
            // ================================
            // Search in Navbar
            // ================================
            initSearch() {
                const searchInput = document.getElementById('navbarSearchInput');
                const searchSuggestions = document.getElementById('searchSuggestions');

                ctor.initializePlaceholders();
                
                if (!searchInput || !searchSuggestions) return;

                $(window).on('resize', ctor.resizeContentSearchSuggestions);
                ctor.resizeContentSearchSuggestions();
                
                // Event listeners para busca
                searchInput.addEventListener('input', (e) => {
                    ctor.handleSearchInput(e.target.value);
                });
                
                searchInput.addEventListener('focus', () => {
                    if (searchInput.value.length >= ctor.searchMinLength) {
                        searchSuggestions.style.display = 'block';
                    }
                });
                
                // Fechar sugestões ao clicar fora
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.search-container') && ctor && ctor.hasOwnProperty('currentSuggestionIndex')) {
                        searchSuggestions.style.display = 'none';
                        ctor.currentSuggestionIndex(-1);
                    };
                });
                
                // Navegação por teclado nas sugestões
                searchInput.addEventListener('keydown', (e) => {
                    ctor.handleSearchKeyboard(e);
                });
            },
            
            handleSearchInput(query) {
                clearTimeout(ctor.searchTimeout());
                
                const searchSuggestions = document.getElementById('searchSuggestions');
                
                if (query.length < ctor.searchMinLength()) {
                    searchSuggestions.style.display = 'none';
                    ctor.currentSuggestionIndex(-1);
                    return;
                }
                
                // Debounce - aguardar 300ms antes de fazer a busca
                ctor.searchTimeout(setTimeout(() => {
                    ctor.onNavSearch(query);
                }, 300));
            },

            initializePlaceholders: () => {
                const searchInput = document.getElementById('navbarSearchInput');
                if (searchInput) {
                    const placeholder = translate._translate('navbar.search-placeholder');
                    searchInput.setAttribute('placeholder', placeholder);
                }
            },
            
            async onNavSearch(query) {
                if (ctor.isSearching()) return;
                
                ctor.isSearching(true);
                const searchSuggestions = document.getElementById('searchSuggestions');
                
                try {
                    // Mostrar loading
                    searchSuggestions.innerHTML = `
                        <div class="p-3 text-center">
                            <div class="spinner-border spinner-border-sm text-primary" role="status">
                                <span class="visually-hidden">Buscando...</span>
                            </div>
                        </div>
                    `;
                    searchSuggestions.style.display = 'block';
                    
                    const response = await fetch(`/search/suggestions/?q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    
                    ctor.renderSearchSuggestions(data.suggestions, query);
                    
                } catch (error) {
                    console.error('Erro ao buscar sugestões:', error);
                    searchSuggestions.innerHTML = `
                        <div class="p-3 text-center text-muted">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <span data-i18n="error-result-found"></span>
                        </div>
                    `;
                } finally {
                    ctor.isSearching(false);
                }
            },
            
            renderSearchSuggestions(suggestions, query) {
                const searchSuggestions = document.getElementById('searchSuggestions');
                
                if (!suggestions || suggestions.length === 0) {
                    searchSuggestions.innerHTML = `
                        <div class="p-3 text-center text-muted">
                            <i class="fas fa-search me-2"></i>
                            <span data-i18n="not-result-found-for"></span> "${query}"
                        </div>
                    `;
                    return;
                }
                
                let html = '<div class="suggestions-list">';
                
                // Separar produtos e categorias
                const products = suggestions.filter(s => s.type === 'product');
                const categories = suggestions.filter(s => s.type === 'category');
                
                // Renderizar produtos
                if (products.length > 0) {
                    html += '<div class="suggestion-section">';
                    html += '<div class="suggestion-header px-3 py-2 bg-light"><small class="text-muted fw-bold text-uppercase" data-i18n="navbar.search-title-products"></small></div>';
                     
                    products.forEach((product, index) => {
                        var noImg = !product.image;
                        var img = null;
                        if(noImg) {
                            img = `
                                <i class="fas fa-shopping-basket no-product-img-found me-3"></i>
                            `;
                        }
                        else {
                            img = `<img src="${product.image}" alt="${product.name}" class="suggestion-image me-3" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">`;
                        };
                        html += `
                            <a href="${product.url}" class="suggestion-item d-flex align-items-center p-3 text-decoration-none border-bottom" data-index="${index}">
                                ${img}
                                <div class="flex-grow-1">
                                    <div class="suggestion-name fw-medium text-dark">${ctor.highlightQuery(product.name, query)}</div>
                                    <div class="suggestion-meta small text-muted">
                                        ${product.category ? `<span class="me-2">${product.category}</span>` : ''}
                                        ${product.brand ? `<span class="me-2">• ${product.brand}</span>` : ''}
                                    </div>
                                </div>
                                <div class="suggestion-price text-primary fw-bold">
                                    ${product.formatted_price}
                                </div>
                            </a>
                        `;
                    });
                    
                    html += '</div>';
                }
                
                // Renderizar categorias
                if (categories.length > 0) {
                    html += '<div class="suggestion-section">';
                    html += '<div class="suggestion-header px-3 py-2 bg-light"><small class="text-muted fw-bold text-uppercase" data-i18n="navbar.search-title-categories"></small></div>';
                    
                    categories.forEach((category, index) => {
                        html += `
                            <a href="${category.url}" class="suggestion-item d-flex align-items-center p-3 text-decoration-none border-bottom" data-index="${products.length + index}">
                                <div class="suggestion-icon me-3">
                                    <i class="fas fa-th-large text-primary"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <div class="suggestion-name fw-medium text-dark">${ctor.highlightQuery(category.name, query)}</div>
                                    <div class="suggestion-meta small text-muted">${category.product_count} produtos</div>
                                </div>
                                <div class="suggestion-arrow">
                                    <i class="fas fa-chevron-right text-muted"></i>
                                </div>
                            </a>
                        `;
                    });
                    
                    html += '</div>';
                }
                
                // Link para ver todos os resultados
                html += `
                    <div class="suggestion-footer p-3 bg-light text-center">
                        <a href="/produtos/buscar/?q=${encodeURIComponent(query)}" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-search me-2"></i>
                            <span data-i18n="navbar.search-all-results"></span>
                        </a>
                    </div>
                `;
                
                html += '</div>';
                
                searchSuggestions.innerHTML = html;
                searchSuggestions.style.display = 'block';
                ctor.currentSuggestionIndex(-1);
            },
            
            highlightQuery(text, query) {
                const regex = new RegExp(`(${query})`, 'gi');
                return text.replace(regex, '<mark class="bg-warning">$1</mark>');
            },
            
            handleSearchKeyboard(e) {
                const searchSuggestions = document.getElementById('searchSuggestions');
                const suggestions = searchSuggestions.querySelectorAll('.suggestion-item');
                
                if (suggestions.length === 0) return;
                
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        ctor.currentSuggestionIndex(Math.min(ctor.currentSuggestionIndex() + 1, suggestions.length - 1));
                        ctor.updateSuggestionSelection(suggestions);
                        break;
                        
                    case 'ArrowUp':
                        e.preventDefault();
                        ctor.currentSuggestionIndex(Math.max(ctor.currentSuggestionIndex() - 1, -1));
                        ctor.updateSuggestionSelection(suggestions);
                        break;
                        
                    case 'Enter':
                        if (ctor.currentSuggestionIndex() >= 0) {
                            e.preventDefault();
                            suggestions[ctor.currentSuggestionIndex()].click();
                        }
                        break;
                        
                    case 'Escape':
                        searchSuggestions.style.display = 'none';
                        ctor.currentSuggestionIndex(-1);
                        break;
                }
            },
            
            updateSuggestionSelection(suggestions) {
                suggestions.forEach((item, index) => {
                    if (index === ctor.currentSuggestionIndex()) item.classList.add('active');
                    else  item.classList.remove('active');
                });
            },

            resizeContentSearchSuggestions: () => {
                const searchInput = document.getElementById('navbarSearchInput');
                const searchSuggestions = document.getElementById('searchSuggestions');
                
                if (!searchInput || !searchSuggestions) return;

                var outerWidth = $(searchInput).outerWidth();
                var left = $(searchInput).offset().left;
                        
                return  $(searchSuggestions)
                        .css('left', left)
                        .width(outerWidth)
                ;
            },

            // ================================
            // CART
            // ================================
            initializeCart: () => {
                const cartDropdown = document.getElementById('cartDropdown');
                if (!cartDropdown) return;
                
                cartDropdown.addEventListener('show.bs.dropdown', async () => {
                    if (!global.user.isAuthenticated) {
                        notify.show('Faça login para adicionar ao carrinho', 'info');
                        window.location.href = '/auth/login/';
                        return;
                    }
                    else if (!ctor.cartDropdownLoaded()) {
                        await ctor.loadCart();
                    }
                });
            },

            openCloseNavbarCart: (status=true) => {
                return utils.openCloseDropdown('cartDropdown',status);
            },

            softReloadCart: (cart) => {
                // Atualizar observables reativos
                ctor.cartItems(cart.items || []);
                ctor.cartCount(cart.total_items || 0);
            },

            softReloadValuesCartItem: (cartItem) => {
                const priceUnit = utils.formatPrice(cartItem.unit_price);
                const priceTotal = utils.formatPrice(cartItem.total_price);
                const quantity = cartItem.quantity;

                var $cartItem = $(`.cart-item[data-item-id='${cartItem.id}']`);
                
                if($cartItem?.length > 0) {
                    var $cartItemPrice = $cartItem.find(`.cart-item-price`);
                    var $cartItemTotal = $cartItem.find(`.cart-item-total`);
                    if($cartItemPrice?.length > 0) $cartItemPrice.text(priceUnit);
                    if($cartItemTotal?.length > 0) $cartItemTotal.text(priceTotal);

                    var $cartItemPriceSpan = $cartItem.find(`#quantity-display-${cartItem.id}`);
                    var $cartItemTotalEdit = $cartItem.find(`#quantity-display-${cartItem.id}-edit-inplace`);
                    if($cartItemPriceSpan?.length > 0) $cartItemPriceSpan.text(quantity);
                    if($cartItemTotalEdit?.length > 0) {
                        $cartItemTotalEdit.val(quantity);
                        $cartItemTotalEdit.text(quantity);
                    };
                };

                ctor.updateCartItemInDOM(cartItem.id, cartItem);
            },

            loadCart: async (onlyCount=false) => {
                const cartContent = document.getElementById('cartDropdownMenu');
                if (!cartContent) return;
                
                ctor.isCartLoading(true);
                
                try {
                    // Show loading
                    if(!onlyCount) cartContent.innerHTML = ctor.getCartLoadingHTML();
                    
                    // Fetch cart data
                    const response = await fetch(`${global.config.apiUrl}cart/current/`);
                    const data = await response.json();
                    
                    if (data.success !== false) {
                        // Atualizar observables reativos
                        ctor.cartItems(data.items || []);
                        ctor.cartCount(data.total_items || 0);
                        
                        if(!onlyCount) {
                            // Renderizar itens
                            ctor.renderCartItems(data.items);
                            
                            // Marcar como carregado
                            ctor.cartDropdownLoaded(true);

                            bindings.reload();
                        };
                    } else {
                        throw new Error(data.message || 'Erro ao carregar carrinho');
                    }
                    
                } catch (error) {
                    console.error('Erro ao carregar carrinho:', error);
                    cartContent.innerHTML = ctor.getCartErrorHTML();
                } finally {
                    ctor.isCartLoading(false);
                }
            },

            renderCartItems: (items) => {
                const cartContent = document.getElementById('cartDropdownMenu');
                if (!cartContent) return;
                
                if (!items || items.length === 0) {
                    cartContent.innerHTML = ctor.getCartEmptyHTML();
                    return;
                }
                
                let html = '<div class="cart-items-list">';
                
                items.forEach(item => {
                    html += ctor.createCartItem(item);
                });
                
                html += `
                    <div class="cart-items-list-total">
                        <span class="cart-items-list-total-msg">${translate._translate('navbar.total')}</span>
                        <span class="cart-items-list-total-digits">${ctor.cartTotal()}</span>
                    </div>
                `;
                html += '</div>';
                cartContent.innerHTML = html;
                
                // Aplicar traduções aos novos elementos
                setTimeout(() => {
                    translate.applyTranslations();
                }, 100);
            },
            
            createCartItem: (item) => {
                const imageHTML = item.product_image ? 
                    `<img src="${item.product_image}" alt="${item.product.name}" class="cart-item-image">` :
                    `<img src="/media/error/no_image.png" class="cart-item-image" loading="lazy">`;
                
                return `
                    <div class="cart-item" data-item-id="${item.id}">
                        <div class="cart-item-image-container">
                            ${imageHTML}
                        </div>
                        <div class="cart-item-details">
                            <span class="cart-item-name">${item.product_name}</span>
                            <span class="cart-item-price">${utils.formatPrice(item.unit_price)}</span>
                        </div>
                        <div class="cart-item-currency">
                            <span class="cart-item-total">${utils.formatPrice(item.total_price)}</span>
                            <div class="cart-item-actions">
                                <div class="quantity-controls">
                                    <button class="btn btn-sm btn-secondary btn-qty-decrease" 
                                            data-item-id="${item.id}" data-product-id="${item.product}"
                                            ${item.quantity <= 1 ? 'disabled' : ''}
                                            data-bind="click: $root.decreaseCartQuantity">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <span id="quantity-display-${item.id}" data-product-id="${item.product}" class="quantity-display" data-bind="editInplace: {'callbackSuccess'='$root.updateCartItemQuantityByHandler','type'='number','customInputClass'='quantity-edit-inplace'}">${item.quantity}</span>
                                    <button class="btn btn-sm btn-secondary btn-qty-increase" 
                                            data-item-id="${item.id}" data-product-id="${item.product}"
                                            data-bind="click: $root.increaseCartQuantity">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                                <button class="btn btn-sm btn-outline-danger btn-remove" 
                                        data-item-id="${item.id}" data-product-id="${item.product}"
                                        data-bind="click: $root.removeFromCart"
                                        title="${translate._translate('navbar.remove-item')}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            },

            increaseCartQuantity: (params) => {
                const itemId = params.$element.attr('data-item-id');
                const productId = params.$element.attr('data-product-id');
                if (itemId && productId) {
                    ctor.updateCartItemQuantity(itemId, productId, 1);
                }
            },
            
            decreaseCartQuantity: (params) => {
                const itemId = params.$element.attr('data-item-id');
                const productId = params.$element.attr('data-product-id');
                if (itemId && productId) {
                    ctor.updateCartItemQuantity(itemId, productId, -1);
                }
            },

            removeFromCart: (params) => {
                const itemId = params.$element.attr('data-item-id');
                const productId = params.$element.attr('data-product-id');
                if (itemId && productId) {
                    ctor.removeCartItem(params.event, itemId, productId);
                }
            },

            updateCartItemQuantityByHandler: async (itemId, oldValue, newValue) => {
                if (ctor.isLoading()) return;
                
                if(!newValue || newValue <= 0) {
                    notify.show(translate._translate('navbar.cart-item-null'), 'warning');
                    return false;
                };

                ctor.isLoading(true);

                try {
                    const productId = parseInt($(`#${itemId}`).attr('data-product-id'));
                    const response = await fetch(`${global.config.apiUrl}cart/update_item_qtd/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': global.config.csrfToken
                        },
                        body: JSON.stringify({
                            item_id: productId,
                            quantity: newValue
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        ctor.softReloadCart(data.cart);
                        var cartItem = data.cart.items.find(x => x.product = productId);
                        if(!cartItem) throw Error('Could not find product with ID: ' + productId);
                        ctor.softReloadValuesCartItem(cartItem);
                        // Mostrar notificação
                        notify.show(translate._translate('navbar.cart-updated'), 'success');
                    } else {
                        if(window['logger']) logger.log(data.message || 'Erro ao atualizar carrinho', 'error');
                        return false;
                    }
                    return true;
                } catch (error) {
                    if(window['logger']) logger.log('Erro ao atualizar quantidade:', error);
                    notify.show(translate._translate('navbar.cart-update-error'), 'error');
                    return false;
                } finally {
                    ctor.isLoading(false);
                }
            },
            
            updateCartItemQuantity: async (itemId, productId, change) => {
                if (ctor.isLoading()) return;
                
                ctor.isLoading(true);

                var action = change < 0 ? 'decrease_qtd_item' : 'increase_qtd_item';
                change = change < 0 ? change * -1 : change;

                itemId = parseInt(itemId);
                productId = parseInt(productId);

                try {
                    const response = await fetch(`${global.config.apiUrl}cart/${action}/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': global.config.csrfToken
                        },
                        body: JSON.stringify({
                            item_id: productId,
                            quantity: change
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        ctor.softReloadCart(data.cart);
                        var cartItem = data.cart.items.find(x => x.product = productId);
                        if(!cartItem) throw Error('Could not find product with ID: ' + productId);
                        ctor.softReloadValuesCartItem(cartItem);
                        // Mostrar notificação
                        notify.show(translate._translate('navbar.cart-updated'), 'success');
                    } else {
                        if(window['logger']) logger.log(data.message || 'Erro ao atualizar carrinho', 'error');
                        return false;
                    }
                    return true;
                } catch (error) {
                    if(window['logger']) logger.log('Erro ao atualizar quantidade:', error);
                    notify.show(translate._translate('navbar.cart-update-error'), 'error');
                    return false;
                } finally {
                    ctor.isLoading(false);
                }
            },

            updateCartItemInDOM: (itemId, item) => {
                const cartItem = document.querySelector(`[data-item-id="${itemId}"]`);
                if (!cartItem) return;
                
                const quantityDisplay = cartItem.querySelector('.quantity-display');
                const totalPrice = cartItem.querySelector('.cart-item-total');
                const decreaseBtn = cartItem.querySelector('.btn-qty-decrease');
                
                if (quantityDisplay) {
                    quantityDisplay.textContent = item.quantity;
                }
                
                if (totalPrice) {
                    totalPrice.textContent = `${utils.formatPrice(item.total_price)}`;
                }
                
                if (decreaseBtn) {
                    decreaseBtn.disabled = item.quantity <= 1;
                }
                
                // Animação visual
                cartItem.classList.add('item-updated');
                setTimeout(() => cartItem.classList.remove('item-updated'), 300);
            },
            
            removeCartItem: async (e, itemId, productId) => {
                e.preventDefault();
                e.stopPropagation();
                return utils.onConfirmationModal({
                    message: translate._translate('navbar.confirm-remove-cart-item')
                }, async (res, params, e) => {
                    if(!res || res.status !== 'ok') return;

                    if (ctor.isLoading()) return;
                    
                    ctor.isLoading(true);
                    try {
                        const response = await fetch(`${global.config.apiUrl}cart/remove_item/`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': global.config.csrfToken
                            }, 
                            body: JSON.stringify({
                                item_id: itemId
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            // Atualizar observables reativos
                            ctor.softReloadCart(data.cart);

                            ctor.removeCartItemFromDOM(itemId);

                            // Mostrar notificação
                            notify.show(translate._translate('navbar.item-removed-cart'), 'success');

                        } else {
                            if(window['logger']) logger.log(data.message || 'Erro ao atualizar carrinho e remover item', 'error');
                            return false;
                        }
                        
                    } catch (error) {
                        if(window['logger']) logger.log('Erro ao atualizar carrinho e remover item:', error);
                        notify.show(translate._translate('navbar.remove-item-error'), 'error');
                        return false;
                    } finally {
                        ctor.isLoading(false);
                    }
                }, e);
            },

            removeCartItemFromDOM: (itemId) => {
                const cartItem = document.querySelector(`[data-item-id="${itemId}"]`);
                if (!cartItem) return;
                cartItem.remove();
                
                // Verificar se o carrinho está vazio
                const cartItems = ctor.cartItems().length === 0;
                if (cartItems) {
                    const cartContent = document.getElementById('cartDropdownMenu');
                    if (cartContent) {
                        cartContent.innerHTML = ctor.getCartEmptyHTML();
                        translate.applyTranslations();
                    };
                }
                
                if(!utils.isDropdownOpened('cartDropdown')) utils.openCloseDropdown('cartDropdown');
            },

            getCartLoadingHTML: () => `
                <div class="cart-loading">
                    <div class="spinner-border spinner-border-sm"></div>
                    <span data-i18n="navbar.loading-cart"></span>
                </div>
            `,
            
            getCartErrorHTML: () => `
                <div class="cart-error">
                    <div class="cart-error-details">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span data-i18n="navbar.cart-load-error"></span>
                    </div>
                    <button class="btn btn-primary align-center full" onclick="ctor.loadCart()">
                        <span data-i18n="navbar.try-again"></span>
                    </button>
                </div>
            `,
            
            getCartEmptyHTML: () => `
                <div class="cart-empty">
                    <div class="cart-empty-details">
                        <i class="fas fa-shopping-cart"></i>
                        <span data-i18n="navbar.empty-cart"></span>
                    </div>
                    <a href="/produtos/" class="btn btn-primary align-center full">
                        <span data-i18n="navbar.start-shopping"></span>
                    </a>
                </div>
            `,

            // ================================
            // WISHLIST
            // ================================
            initializeWishlist: () => {
                const wishlistDropdown = document.getElementById('wishlistDropdown');
                if (!wishlistDropdown) return;
                
                wishlistDropdown.addEventListener('show.bs.dropdown', async () => {
                    if (!global.user.isAuthenticated) {
                        notify.show('Faça login para adicionar aos favoritos', 'info');
                        window.location.href = '/auth/login/';
                        return;
                    }
                    else if (!ctor.wishlistDropdownLoaded()) {
                        await ctor.loadWishlist();
                    }
                });
            },

            openCloseNavbarWishlist: (status=true) => {
                return utils.openCloseDropdown('wishlistDropdown',status);
            },

            softReloadWishlist: (wishlist) => {
                // Atualizar observables reativos
                ctor.wishlistItems(wishlist.items || []);
                ctor.wishlistCount(wishlist.total_items || 0);
            },

            softReloadValuesWishlistItem: (wishlistItem) => {
            },

            loadWishlist: async (onlyCount=false) => {
                const wishlistContent = document.getElementById('wishlistDropdownMenu');
                if (!wishlistContent) return;
                
                ctor.isWishlistLoading(true);
                
                try {
                    // Show loading
                    if(!onlyCount) wishlistContent.innerHTML = ctor.getWishlistLoadingHTML();
                    
                    // Fetch wishlist data
                    const response = await fetch(`${global.config.apiUrl}wishlist/current/`);
                    const data = await response.json();
                    
                    if (data.success !== false) {
                        // Atualizar observables reativos
                        ctor.wishlistItems(data.items || []);
                        ctor.wishlistCount(data.total_items || 0);
                        
                        if(!onlyCount) {
                            // Renderizar itens
                            ctor.renderWishlistItems(data.items);
                            
                            // Marcar como carregado
                            ctor.wishlistDropdownLoaded(true);

                            bindings.reload();
                        };
                    } else {
                        throw new Error(data.message || 'Erro ao carregar lista de desejos');
                    }
                    
                } catch (error) {
                    console.error('Erro ao carregar lista de desejos:', error);
                    wishlistContent.innerHTML = ctor.getWishlistErrorHTML();
                } finally {
                    ctor.isWishlistLoading(false);
                }
            },

            renderWishlistItems: (items) => {
                const wishlistContent = document.getElementById('wishlistDropdownMenu');
                if (!wishlistContent) return;
                
                if (!items || items.length === 0) {
                    wishlistContent.innerHTML = ctor.getWishlistEmptyHTML();
                    return;
                }
                
                let html = '<div class="wishlist-items-list">';
                
                items.forEach(item => {
                    html += ctor.createWishlistItem(item);
                });
                
                html += '</div>';
                wishlistContent.innerHTML = html;
                
                // Aplicar traduções aos novos elementos
                setTimeout(() => {
                    translate.applyTranslations();
                }, 100);
            },
            
            createWishlistItem: (item) => {
                const imageHTML = item.product_image ? 
                    `<img src="${item.product_image}" alt="${item.product.name}" class="wishlist-item-image">` :
                    `<img src="/media/error/no_image.png" class="wishlist-item-image" loading="lazy">`;
                
                return `
                    <div class="wishlist-item" data-item-id="${item.id}">
                        <div class="wishlist-item-image-container">
                            ${imageHTML}
                        </div>
                        <div class="wishlist-item-details">
                            <span class="wishlist-item-name">${item.product_name}</span>
                            <span class="wishlist-item-price">${utils.formatPrice(item.unit_price)}</span>
                        </div>
                        <div class="wishlist-item-actions">
                            <button class="btn btn-sm btn-primary btn-qty-decrease" 
                                data-item-id="${item.id}" data-product-id="${item.product}"
                                data-bind="click: $root.addWishToCart" data-i18n="navbar.add-item-cart">
                            </button>
                        </div>
                    </div>
                `;
            },

            addWishToCart: (params) => {
            },

            removeFromWishlist: (params) => {
                const itemId = params.$element.attr('data-item-id');
                const productId = params.$element.attr('data-product-id');
                if (itemId && productId) {
                    ctor.removeWishlistItem(params.event, itemId, productId);
                }
            },

            removeWishlistItem: async (e, itemId, productId) => {
                e.preventDefault();
                e.stopPropagation();
                return utils.onConfirmationModal({
                    message: translate._translate('navbar.confirm-remove-wishlist-item')
                }, async (res, params, e) => {
                    if(!res || res.status !== 'ok') return;

                    if (ctor.isLoading()) return;
                    
                    ctor.isLoading(true);
                    try {
                        const response = await fetch(`${global.config.apiUrl}wishlist/remove_item/`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': global.config.csrfToken
                            }, 
                            body: JSON.stringify({
                                item_id: itemId
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            // Atualizar observables reativos
                            ctor.softReloadWishlist(data.wishlist);

                            ctor.removeWishlistItemFromDOM(itemId);

                            // Mostrar notificação
                            notify.show(translate._translate('navbar.item-removed-wishlist'), 'success');

                        } else {
                            if(window['logger']) logger.log(data.message || 'Erro ao atualizar lista de desejos e remover item', 'error');
                            return false;
                        }
                        
                    } catch (error) {
                        if(window['logger']) logger.log('Erro ao atualizar lista de desejos e remover item:', error);
                        notify.show(translate._translate('navbar.remove-item-error'), 'error');
                        return false;
                    } finally {
                        ctor.isLoading(false);
                    }
                }, e);
            },

            removeWishlistItemFromDOM: (itemId) => {
                const wishlistItem = document.querySelector(`[data-item-id="${itemId}"]`);
                if (!wishlistItem) return;
                wishlistItem.remove();
                
                // Verificar se o carrinho está vazio
                const wishlistItems = ctor.wishlistItems().length === 0;
                if (wishlistItems) {
                    const wishlistContent = document.getElementById('wishlistDropdownMenu');
                    if (wishlistContent) {
                        wishlistContent.innerHTML = ctor.getWishlistEmptyHTML();
                        translate.applyTranslations();
                    };
                }
                
                if(!utils.isDropdownOpened('wishlistDropdown')) utils.openCloseDropdown('wishlistDropdown');
            },

            getWishlistLoadingHTML: () => `
                <div class="wishlist-loading">
                    <div class="spinner-border spinner-border-sm"></div>
                    <span data-i18n="navbar.loading-wishlist"></span>
                </div>
            `,
            
            getWishlistErrorHTML: () => `
                <div class="wishlist-error">
                    <div class="wishlist-error-details">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span data-i18n="navbar.wishlist-load-error"></span>
                    </div>
                    <button class="btn btn-primary align-center full" onclick="ctor.loadWishlist()">
                        <span data-i18n="navbar.try-again"></span>
                    </button>
                </div>
            `,
            
            getWishlistEmptyHTML: () => `
                <div class="wishlist-empty">
                    <div class="wishlist-empty-details">
                        <i class="fas fa-shopping-wishlist"></i>
                        <span data-i18n="navbar.empty-wishlist"></span>
                    </div>
                    <a href="/produtos/" class="btn btn-primary align-center full">
                        <span data-i18n="navbar.start-shopping"></span>
                    </a>
                </div>
            `,

            // ================================
            // ANIMATIONS & VISUAL EFFECTS
            // ================================
            
            initializeAnimations: () => {
                // CSS animations setup
                ctor.addAnimationStyles();
            },
            
            animateCartUpdate: () => {
                const cartIcon = document.querySelector('.nav-cart .dropdown-toggle');
                if (cartIcon) {
                    cartIcon.classList.add('animate-pulse');
                    setTimeout(() => {
                        cartIcon.classList.remove('animate-pulse');
                    }, ctor.config.cartUpdateAnimationDuration);
                }
            },
            
            animateCartItemRemoval: (itemId) => {
                const cartItem = document.querySelector(`[data-item-id="${itemId}"]`);
                if (cartItem) {
                    cartItem.classList.add('animate-slide-out');
                    setTimeout(() => {
                        cartItem.remove();
                    }, 300);
                }
            },
            
            animateWishlistToggle: (button) => {
                if (!button) return;
                
                button.classList.add('animate-heart-beat');
                setTimeout(() => {
                    button.classList.remove('animate-heart-beat');
                }, ctor.config.wishlistToggleAnimationDuration);
            },
            
            animateAddToCart: (productId) => {
                // Create floating animation from product to cart
                const cartIcon = document.querySelector('.nav-cart .dropdown-toggle');
                const productElement = document.querySelector(`[data-product-id="${productId}"]`);
                
                if (cartIcon && productElement) {
                    ctor.createFloatingAnimation(productElement, cartIcon, 'cart');
                }
            },
            
            createFloatingAnimation: (fromElement, toElement, type) => {
                const fromRect = fromElement.getBoundingClientRect();
                const toRect = toElement.getBoundingClientRect();
                
                const floatingIcon = document.createElement('div');
                floatingIcon.className = `floating-icon floating-${type}`;
                
                if (type === 'cart') {
                    floatingIcon.innerHTML = '<i class="fas fa-shopping-cart"></i>';
                } else {
                    floatingIcon.innerHTML = '<i class="fas fa-heart"></i>';
                }
                
                floatingIcon.style.cssText = `
                    position: fixed;
                    left: ${fromRect.left + fromRect.width / 2}px;
                    top: ${fromRect.top + fromRect.height / 2}px;
                    z-index: 9999;
                    pointer-events: none;
                    transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    color: ${type === 'cart' ? '#007bff' : '#dc3545'};
                    font-size: 20px;
                `;
                
                document.body.appendChild(floatingIcon);
                
                // Start animation
                setTimeout(() => {
                    floatingIcon.style.cssText += `
                        left: ${toRect.left + toRect.width / 2}px;
                        top: ${toRect.top + toRect.height / 2}px;
                        transform: scale(0.3);
                        opacity: 0;
                    `;
                }, 50);
                
                // Remove after animation
                setTimeout(() => {
                    floatingIcon.remove();
                }, 850);
            },
            
            addAnimationStyles: () => {
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); }
                    }
                    
                    @keyframes heart-beat {
                        0% { transform: scale(1); }
                        14% { transform: scale(1.3); }
                        28% { transform: scale(1); }
                        42% { transform: scale(1.3); }
                        70% { transform: scale(1); }
                    }
                    
                    @keyframes slide-out {
                        0% { transform: translateX(0); opacity: 1; }
                        100% { transform: translateX(-100%); opacity: 0; }
                    }
                    
                    .animate-pulse {
                        animation: pulse 0.6s ease-in-out;
                    }
                    
                    .animate-heart-beat {
                        animation: heart-beat 0.4s ease-in-out;
                    }
                    
                    .animate-slide-out {
                        animation: slide-out 0.3s ease-in-out forwards;
                    }
                `;
                document.head.appendChild(style);
            },

            // ================================
            // UTILITY METHODS
            // ================================
            
            updateCartCount: (count) => {
                ctor.cartCount(count);
                const cartCounters = document.querySelectorAll('#cartCount, .cart-count');
                cartCounters.forEach(counter => {
                    counter.textContent = count;
                    counter.closest('.nav-cart')?.classList.toggle('has-items', count > 0);
                });
            },
            
            updateWishlistCount: (count) => {
                ctor.wishlistCount(count);
                const wishlistCounters = document.querySelectorAll('#wishListCount, .wishlist-count');
                wishlistCounters.forEach(counter => {
                    counter.textContent = count;
                    counter.closest('.nav-wishlist')?.classList.toggle('has-items', count > 0);
                });
            },
            
            updateWishlistButton: (button, added) => {
                if (!button) return;
                button = button[0];
                
                const icon = button.querySelector('i');
                if (added) {
                    icon.className = 'fas fa-heart';
                    button.classList.add('active');
                } else {
                    icon.className = 'far fa-heart';
                    button.classList.remove('active');
                }
            },

            // Event handlers para mudanças de estado
            handleCartUpdated: (event) => {
                ctor.updateCartCount(event.detail.count);
                ctor.cartDropdownLoaded(false);
            },
            
            handleWishlistUpdated: (event) => {
                ctor.updateWishlistCount(event.detail.count);
                ctor.wishlistDropdownLoaded(false);
            },
            
            handleUserLoggedIn: async () => {
                await ctor.loadInitialData();
            },
            
            handleUserLoggedOut: () => {
                ctor.cartCount(0);
                ctor.wishlistCount(0);
                ctor.cartDropdownLoaded(false);
                ctor.wishlistDropdownLoaded(false);
                ctor.updateCartCount(0);
                ctor.updateWishlistCount(0);
            }
        }
    }
)
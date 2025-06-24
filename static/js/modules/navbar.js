define(`/static/js/modules/navbar.js`, '/static/js/mixins/components.js', 
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
            compositionComplete: (name, path, dependencies, callback, params) => {
                ctor.initSearch();
                ctor.initCartDropdown();
                ctor.subscribeChanges();
                return ctor.loadSubNavbarRow();
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
                                <i class="fas fa-shopping-basket no-product-img-found"></i>
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
                return $(searchSuggestions).width(outerWidth);
            },
            // ================================
            // Cart
            // ================================
            initCartDropdown() {
                const cartDropdown = document.getElementById('cartDropdown');
                
                if (!cartDropdown) return;
                
                // Carregar conteúdo quando abrir o dropdown
                cartDropdown.addEventListener('show.bs.dropdown', () => {
                    ctor.loadCartDropdown();
                });
            },

            subscribeChanges: () => {
                ctor.cartCount.subscribe((newValue) => {
                    return ctor.updateCartCount(newValue);
                });
            },
            
            async loadCartDropdown() {
                debugger;
                const cartDropdownContent = document.getElementById('cartDropdownContent');
                
                if (!cartDropdownContent) return;
                
                try {
                    // Mostrar loading
                    cartDropdownContent.innerHTML = `
                        <div class="text-center p-3">
                            <div class="spinner-border spinner-border-sm text-primary" role="status">
                                <span class="visually-hidden">${translate._translate('loading')}</span>
                            </div>
                        </div>
                    `;
                    
                    const response = await fetch('/pedidos/cart/dropdown/');
                    const data = await response.json();
                    
                    if (data.html) {
                        cartDropdownContent.innerHTML = data.html;
                        ctor.cartCount(data.total_items);
                    };
                } catch (error) {
                    console.error('Erro ao carregar carrinho:', error);
                    cartDropdownContent.innerHTML = `
                        <div class="text-center p-3 text-muted">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Erro ao carregar carrinho
                        </div>
                    `;
                }
            },

            updateCartCount() {
                const cartCountElements = document.querySelectorAll('#cartCount');
                cartCountElements.forEach(element => {
                    element.classList.add('animate-bounce');
                    setTimeout(() => {
                        element.classList.remove('animate-bounce');
                    }, 600);
                });
            }
        }
    }
)
define(`/static/js/modules/core/home.js`, ['/static/js/mixins/components.js', `/static/js/modules/navbar.js`], 
    function Home() {
        return {
            name: `Home`,
            kind: bindings.observable(`module`),
            modules: bindings.observable([]),
            
            // Configuration
            config: {
                heroCarouselInterval: 3000,
                animationDuration: 300,
                skeletonTimeout: 1000,
                statsAnimationDuration: 2000,
                sliderItemsPerView: 4,
                sliderItemsPerViewMobile: 2,
                sliderItemsPerViewTablet: 3
            },

            heroCarouselPrevClass: 'carousel-control-prev',
            heroCarouselNextClass: 'carousel-control-next',
            
            // State
            state: {
                isLoading: false,
                currentSlide: 0,
                sliderPosition: 0,
                statsAnimated: false,
                observersInitialized: false
            },
            
            // Main composition
            compositionComplete: async (name, path, dependencies, callback, params) => {
                try {
                    // Initialize components
                    await ctor.initializeComponents();
                    
                    // Load content
                    await ctor.loadInitialContent();
                    
                    // Setup interactions
                    ctor.setupInteractions();
                    
                    // Initialize observers
                    ctor.initializeObservers();

                    // utils.onConfirmationModal({ message: 'Test' }, () => {
                    //     return true;
                    // });
                    
                    if(window['logger']) logger.log('Home module initialized successfully', 'info');
                    return bindings.reload();
                } catch (error) {
                    console.error('Error initializing Home module:', error);
                    ctor.showError('Erro ao carregar a página');
                }
            },

            // ================================
            // INITIALIZATION METHODS
            // ================================
            
            initializeComponents: async () => {
                // Initialize carousel
                ctor.initializeCarousel();
                
                // Initialize sliders
                ctor.initializeSliders();
                
                // Initialize lazy loading
                ctor.initializeLazyLoading();
                
                // Initialize animations
                ctor.initializeAnimations();
            },
            
            initializeCarousel: () => {
                const carouselElement = document.getElementById('heroCarousel');
                if (!carouselElement) return;
                
                // Initialize Bootstrap carousel
                const carousel = new bootstrap.Carousel(carouselElement, {
                    interval: ctor.config.heroCarouselInterval,
                    wrap: true,
                    touch: true,
                    pause: 'hover'
                });
                
                // Custom event handlers
                carouselElement.addEventListener('slide.bs.carousel', (event) => {
                    const module = global.getModule('Home');
                    module.state.currentSlide = event.to;
                    module.updateCarouselIndicators(event.to);
                });
                
                // Keyboard navigation
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowLeft') carousel.prev();
                    if (e.key === 'ArrowRight') carousel.next();
                });
                
                
                const prevBtnHero = document.getElementsByClassName(`${ctor.heroCarouselPrevClass}`);
                const nextBtnHero = document.getElementsByClassName(`${ctor.heroCarouselNextClass}`);
                
                if (prevBtnHero) prevBtnHero[0].addEventListener('click', () => carousel.prev());
                if (nextBtnHero) nextBtnHero[0].addEventListener('click', () => carousel.next());
                
            },
            
            initializeSliders: () => {
                // New products slider
                const slider = document.getElementById('newProductsSlider');
                if (!slider) return;
                
                const prevBtn = document.getElementById('newProductsPrev');
                const nextBtn = document.getElementById('newProductsNext');
                
                if (prevBtn) prevBtn.addEventListener('click', () => ctor.slideProducts('prev'));
                if (nextBtn) nextBtn.addEventListener('click', () => ctor.slideProducts('next'));
                
                // Touch/swipe support
                ctor.addTouchSupport(slider);
            },
            
            initializeLazyLoading: () => {
                if ('IntersectionObserver' in window) {
                    const imageObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const img = entry.target;
                                if (img.dataset.src) {
                                    img.src = img.dataset.src;
                                    img.classList.remove('lazy');
                                    img.classList.add('loaded');
                                    imageObserver.unobserve(img);
                                }
                            }
                        });
                    }, {
                        rootMargin: '50px'
                    });

                    // Observe all lazy images
                    document.querySelectorAll('img[data-src]').forEach(img => {
                        imageObserver.observe(img);
                    });
                }
            },
            
            initializeAnimations: () => {
                // Initialize AOS or similar animation library
                // For now, we'll use a simple scroll animation
                ctor.initializeScrollAnimations();
            },
            
            initializeObservers: () => {
                if (ctor.state.observersInitialized) return;
                
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const target = entry.target;
                            
                            // Animate stats section
                            if (target.classList.contains('stats-section') && !ctor.state.statsAnimated) {
                                ctor.animateStats();
                                ctor.state.statsAnimated = true;
                            }
                            
                            // Animate other sections
                            if (target.classList.contains('home-section')) {
                                target.classList.add('animate-in');
                            }
                        }
                    });
                }, {
                    threshold: 0.1
                });
                
                // Observe all sections
                document.querySelectorAll('.home-section').forEach(section => {
                    observer.observe(section);
                });
                
                ctor.state.observersInitialized = true;
            },
            
            // ================================
            // CONTENT LOADING METHODS
            // ================================
            
            loadInitialContent: async () => {
                const loadPromises = [
                    ctor.loadCategories(),
                    ctor.loadFeaturedProducts(),
                    // ctor.loadSpecialOffers(),
                    // ctor.loadPopularProducts(),
                    // ctor.loadNewProducts()
                ];
                
                // Load all content in parallel
                await Promise.allSettled(loadPromises);
                
                // Remove skeleton loading
                setTimeout(() => {
                    const module = global.getModule('Home');
                    module.removeSkeletonLoading();
                }, ctor.config.skeletonTimeout);
            },
            
            loadCategories: async () => {
                try {
                    const response = await fetch(`${global.config.apiUrl}home/categories/`);
                    const categories = await response.json();
                    
                    const grid = document.getElementById('categoriesGrid');
                    grid.innerHTML = '';
                    
                    if (categories.results.length !== 0) {
                        const results = categories.results.sort((a, b) => {
                            if (a.sort_order !== b.sort_order) {
                                return a.sort_order - b.sort_order;
                            }
                            return b.product_count - a.product_count;
                        });
                        results.forEach(category => {
                            const categoryCard = ctor.createCategoryCard(category);
                            grid.appendChild(categoryCard);
                        });
                    }
                    else return grid.innerHTML = '<div class="no-content-drop col-12 text-center"><p>Nenhuma categoria encontrada</p></div>';
                } catch (error) {
                    console.error('Error loading categories:', error);
                    notify.show('Erro ao carregar categorias', 'error');
                } finally {
                    $(`.category-section`).addClass(`visible`);
                }
            },

            loadFeaturedProducts: async () => {
                try {
                    const response = await fetch(`${global.config.apiUrl}home/featured_products/`);
                    const products = await response.json();
                    
                    const grid = document.getElementById('featuredGrid');
                    grid.innerHTML = '';
                    
                    if (products.results.length !== 0) {
                        products.results.forEach(product => {
                            const productCard = ctor.createProductCard(product);
                            grid.appendChild(productCard);
                        });
                    }
                    else return grid.innerHTML = '<div class="no-content-drop col-12 text-center"><p>Nenhuma produto em destaque encontrado</p></div>';
                } catch (error) {
                    console.error('Error loading featured products:', error);
                    ctor.showError('Erro ao carregar produtos em destaque');
                } finally {
                    $(`.products-section`).addClass(`visible`);
                }
            },
            
            loadSpecialOffers: async () => {
                try {
                    const response = await fetch(`${global.config.apiUrl}home/special_offers/`);
                    if (!response.ok) throw new Error('Failed to load offers');
                    
                    const data = await response.json();
                    const container = document.getElementById('offersGrid');
                    
                    if (data.results && data.results.length > 0) {
                        container.innerHTML = data.results.map(product => 
                            ctor.createOfferCard(product)
                        ).join('');
                    } else {
                        container.innerHTML = ctor.createEmptyState('Nenhuma oferta disponível');
                    }
                } catch (error) {
                    console.error('Error loading offers:', error);
                    ctor.handleLoadError('offersGrid', 'Erro ao carregar ofertas');
                } 
            },
            
            loadPopularProducts: async () => {
                try {
                    const response = await fetch(`${global.config.apiUrl}home/popular_products/`);
                    if (!response.ok) throw new Error('Failed to load popular products');
                    
                    const data = await response.json();
                    const container = document.getElementById('popularGrid');
                    
                    if (data.results && data.results.length > 0) {
                        container.innerHTML = data.results.map(product => 
                            ctor.createProductCard(product, { popular: true })
                        ).join('');
                    } else {
                        container.innerHTML = ctor.createEmptyState('Nenhum produto popular encontrado');
                    }
                } catch (error) {
                    console.error('Error loading popular products:', error);
                    ctor.handleLoadError('popularGrid', 'Erro ao carregar produtos populares');
                }
            },
            
            loadNewProducts: async () => {
                try {
                    const response = await fetch(`${global.config.apiUrl}home/new_products/`);
                    if (!response.ok) throw new Error('Failed to load new products');
                    
                    const data = await response.json();
                    const container = document.getElementById('newProductsTrack');
                    
                    if (data.results && data.results.length > 0) {
                        container.innerHTML = data.results.map(product => 
                            ctor.createProductCard(product, { new: true })
                        ).join('');
                        
                        // Update slider after content load
                        ctor.updateSliderState();
                    } else {
                        container.innerHTML = ctor.createEmptyState('Nenhum produto novo encontrado');
                    }
                } catch (error) {
                    console.error('Error loading new products:', error);
                    ctor.handleLoadError('newProductsTrack', 'Erro ao carregar novos produtos');
                }
            },
            
            // ================================
            // CARD CREATION METHODS
            // ================================
            
            createCategoryCard: (category) => {
                const col = document.createElement('div');
                col.className = 'category-item col-lg-2 col-md-3 col-sm-4 col-6 mb-4';
                col.name = `category_${category.id}`;
                col.id = `${category.id}`;

                $(col).attr("id", col.id);
                $(col).attr("name", col.name);

                col.innerHTML = `
                    <a href="/produtos/categoria/${category.slug}/" class="text-decoration-none">
                        <div class="category-card">
                            ${ category.image ? `<img src="${category.image}" class="category-image"></img>` : "" } 
                            <div class="category-overlay">
                                <div>
                                    <h3 class="category-title">${category.name}</h3>
                                    <p class="category-count">${category.product_count || 0} produtos</p>
                                </div>
                            </div>
                        </div>
                    </a>
                `;
                
                return col;
            },

            createProductCard: (product, isDeal = false, isNew = false) => {
                const col = document.createElement('div');
                col.className = 'product-item col-lg-3 col-md-4 col-sm-6 mb-4';

                col.name = `product_${product.id}`;
                col.id = `${product.id}`;

                $(col).attr("id", col.id);
                $(col).attr("name", col.name);
                
                // Calculate discount percentage
                const discountPercent = product.compare_at_price && product.compare_at_price > product.price 
                    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
                    : 0;
                
                // Generate stars
                const stars = ctor.generateStars(product.avg_rating || 0);
                
                // Badge logic
                let badge = '';
                if (isNew) badge = '<span class="product-badge new">Novo</span>';
                else if (isDeal && discountPercent > 0) badge = '<span class="product-badge sale">Oferta</span>';
                
                const productImage = product.images.find(x => x.is_primary === true);

                col.innerHTML = `
                    <div class="product-card" data-product-id="${product.id}">
                        <div class="product-image">
                            ${ productImage && productImage?.image ? 
                                `<img src="${productImage.image}" class="product-image" loading="lazy"></img>` : 
                                `<img src="/media/error/no_image.png" class="product-image" loading="lazy"></img>` 
                            } 
                            ${badge}
                            <button class="product-wishlist" 
                                    data-product-id="${product.id}" 
                                    data-bind="click: $root.toggleWishlist" 
                                    title="Adicionar à lista de desejos">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                        <div class="product-info">
                            <div class="product-category" data-category-id="${product.category}">${product.category_name || 'Sem categoria'}</div>
                            <h3 class="product-title">
                                <a href="/produtos/produto/${product.slug}/" class="text-decoration-none">
                                    ${product.name}
                                </a>
                            </h3>
                            <div class="product-rating">
                                <div class="stars">${stars}</div>
                                <span class="rating-count">(${product.review_count || 0})</span>
                            </div>
                            <div class="product-price">
                                ${discountPercent && discountPercent < 0 ?
                                    `<span class="price-current">${utils.formatPrice(product.compare_at_price)}</span>
                                        ${product.compare_at_price && product.compare_at_price > product.price ? 
                                            `<span class="price-old">${utils.formatPrice(product.price)}</span>
                                            <span class="price-discount">${discountPercent}%</span>` : ''}
                                    `
                                    :
                                    `<span class="price-current">${utils.formatPrice(product.price)}</span>`
                                }
                            
                            </div>
                            <div class="product-actions">
                                <button class="btn btn-primary full btn-cart" 
                                        data-product-id="${product.id}"
                                        data-bind="click: $root.addToCart">
                                    <i class="fas fa-shopping-cart me-2"></i>
                                    Comprar
                                </button>
                                <button class="btn btn-outline-primary btn-quick-view" 
                                        data-product-id="${product.id}"
                                        onclick="ctor.quickView(${product.id})">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                return col;
            },
            
            createOfferCard: (product) => {
                const imageUrl = product.primary_image || '/static/images/placeholder-product.jpg';
                const discountPercent = ctor.calculateDiscount(product.price, product.compare_at_price);
                const savings = product.compare_at_price - product.price;
                
                return `
                    <div class="offer-card" data-product-id="${product.id}">
                        <div class="offer-image">
                            <img src="${imageUrl}" alt="${product.name}" loading="lazy" />
                            <div class="offer-badge">
                                <span class="discount-percent">-${discountPercent}%</span>
                                <span class="savings-amount">Economize ${utils.formatPrice(savings)}</span>
                            </div>
                        </div>
                        <div class="offer-info">
                            <h3 class="offer-name">${product.name}</h3>
                            <div class="offer-price">
                                <span class="price-current">${utils.formatPrice(product.price)}</span>
                                <span class="price-old">${utils.formatPrice(product.compare_at_price)}</span>
                            </div>
                            <div class="offer-timer" data-expires="${product.offer_expires}">
                                <i class="fas fa-clock me-2"></i>
                                <span class="timer-text">Oferta por tempo limitado</span>
                            </div>
                            <button class="btn btn-danger btn-block btn-add-cart" 
                                    data-product-id="${product.id}">
                                <i class="fas fa-fire me-2"></i>
                                Aproveitar Oferta
                            </button>
                        </div>
                    </div>
                `;
            },
            // ================================
            // INTERACTION METHODS
            // ================================
            
            setupInteractions: () => {
                // Newsletter form
                ctor.setupNewsletterForm();
                
                // Product interactions
                ctor.setupProductInteractions();
                
                // Keyboard shortcuts
                ctor.setupKeyboardShortcuts();
            },
            
            setupNewsletterForm: () => {
                const form = document.getElementById('newsletterForm');
                if (!form) return;
                
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const emailInput = document.getElementById('newsletterEmail');
                    const email = emailInput.value.trim();
                    
                    if (!ctor.validateEmail(email)) {
                        notify.show('Por favor, insira um e-mail válido', 'warning');
                        return;
                    }
                    
                    try {
                        const response = await fetch(`${global.config.apiUrl}newsletter/subscribe/`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': global.config.csrfToken
                            },
                            body: JSON.stringify({ email })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            notify.show('Cadastro realizado com sucesso!', 'success');
                            emailInput.value = '';
                        } else {
                            notify.show(data.message || 'Erro ao cadastrar e-mail', 'error');
                        }
                    } catch (error) {
                        console.error('Newsletter subscription error:', error);
                        notify.show('Erro ao cadastrar e-mail', 'error');
                    }
                });
            },
            
            setupProductInteractions: () => {
                // Add to cart buttons
                document.addEventListener('click', (e) => {
                    if (e.target.matches('.btn-add-cart, .btn-add-cart *')) {
                        const button = e.target.closest('.btn-add-cart');
                        const productId = button.dataset.productId;
                        if (productId) {
                            ctor.addToCart(productId, button);
                        }
                    }
                });
                
                // Wishlist buttons
                document.addEventListener('click', (e) => {
                    if (e.target.matches('.btn-wishlist, .btn-wishlist *')) {
                        const button = e.target.closest('.btn-wishlist');
                        const productId = button.dataset.productId;
                        if (productId) {
                            ctor.toggleWishlist(productId, button);
                        }
                    }
                });
                
                // Quick view buttons
                document.addEventListener('click', (e) => {
                    if (e.target.matches('.btn-quick-view, .btn-quick-view *')) {
                        const button = e.target.closest('.btn-quick-view');
                        const productId = button.dataset.productId;
                        if (productId) {
                            ctor.openQuickView(productId);
                        }
                    }
                });
            },
            
            setupKeyboardShortcuts: () => {
                document.addEventListener('keydown', (e) => {
                    // ESC key closes modals/dropdowns
                    if (e.key === 'Escape') {
                        ctor.closeModals();
                    }
                    
                    // Arrow keys for carousel navigation
                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                        if (e.key === 'ArrowLeft') {
                            ctor.slideProducts('prev');
                        } else if (e.key === 'ArrowRight') {
                            ctor.slideProducts('next');
                        }
                    }
                });
            },
            
            // ================================
            // PRODUCT ACTIONS
            // ================================
            
            addToCart: async (params) => {
                // Check if user is authenticated
                if (!global.user.isAuthenticated) {
                    notify.show('Faça login para adicionar produtos ao carrinho', 'info');
                    window.location.href = '/auth/login/';
                    return;
                }
                var button, productId;
                
                if (params.$element.is(`button`) && params.$element.hasClass('btn-cart')) {
                    button = params.$element;
                    productId = button.data().productId;
                };

                if (!button || !productId) return;

                utils.loading();
                try {
                    const response = await fetch(`${global.config.apiUrl}cart/add_item/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': global.config.csrfToken
                        },
                        body: JSON.stringify({
                            product_id: productId,
                            quantity: 1
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update cart count in navbar
                        ctor.updateCartCount(data.cart_count);
                        
                        // Show success animation
                        ctor.animateAddToCart(button);
                        
                        // Show success notification
                        notify.show('Produto adicionado ao carrinho!', 'success');
                        
                        // Optionally show cart preview
                        ctor.cartCount(data.cart_count);
                        
                    } else {
                        throw new Error(data.message || 'Erro ao adicionar ao carrinho');
                    }
                    
                } catch (error) {
                    console.error('Add to cart error:', error);
                    notify.show('Erro ao adicionar produto ao carrinho', 'error');
                } finally {
                    utils.loading(false);
                }
            },
            
            toggleWishlist: async (params) => {
                // Check if user is authenticated
                if (!global.user.isAuthenticated) {
                    notify.show('Faça login para adicionar aos favoritos', 'info');
                    window.location.href = '/auth/login/';
                    return;
                }
                
                var button, productId;
                
                if (params.$element.is(`button`) && params.$element.hasClass('product-wishlist')) {
                    button = params.$element;
                    productId = button.data().productId;
                };

                if (!button || !productId) return;

                utils.loading();
                
                try {
                    const response = await fetch(`${global.config.apiUrl}wishlist/toggle/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': global.config.csrfToken
                        },
                        body: JSON.stringify({
                            product_id: productId
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update wishlist count in navbar
                        ctor.updateWishlistCount(data.wishlist_count);
                        
                        // Update button state
                        ctor.updateWishlistButton(button, data.added);
                        
                        // Show notification
                        const message = data.added ? 
                            'Produto adicionado aos favoritos!' : 
                            'Produto removido dos favoritos!';
                        notify.show(message, 'success');
                        
                        // Animate button
                        ctor.animateWishlist(button);
                        
                    } else {
                        throw new Error(data.message || 'Erro ao atualizar favoritos');
                    }
                    
                } catch (error) {
                    console.error('Wishlist toggle error:', error);
                    notify.show('Erro ao atualizar favoritos', 'error');
                } finally {
                    utils.loading(false);
                }
            },
            
            openQuickView: async (productId) => {
                if (!productId) return;
                
                try {
                    const response = await fetch(`${global.config.apiUrl}products/${productId}/quick-view/`);
                    const data = await response.json();
                    
                    if (data.success) {
                        const modal = document.getElementById('quickViewModal');
                        const content = document.getElementById('quickViewContent');
                        
                        content.innerHTML = ctor.createQuickViewContent(data.product);
                        
                        // Show modal
                        const modalInstance = new bootstrap.Modal(modal);
                        modalInstance.show();
                        
                        // Setup quick view interactions
                        ctor.setupQuickViewInteractions(data.product);
                        
                    } else {
                        throw new Error(data.message || 'Erro ao carregar produto');
                    }
                    
                } catch (error) {
                    console.error('Quick view error:', error);
                    notify.show('Erro ao carregar visualização rápida', 'error');
                }
            },
            
            // ================================
            // SLIDER METHODS
            // ================================
            
            slideProducts: (direction) => {
                const track = document.getElementById('newProductsTrack');
                if (!track) return;
                
                const items = track.children;
                const itemsCount = items.length;
                
                if (itemsCount === 0) return;
                
                const itemWidth = items[0].offsetWidth + 20; // Include margin
                const containerWidth = track.parentElement.offsetWidth;
                const itemsPerView = Math.floor(containerWidth / itemWidth);
                const maxPosition = Math.max(0, itemsCount - itemsPerView);
                
                if (direction === 'prev') {
                    ctor.state.sliderPosition = Math.max(0, ctor.state.sliderPosition - 1);
                } else {
                    ctor.state.sliderPosition = Math.min(maxPosition, ctor.state.sliderPosition + 1);
                }
                
                const translateX = -(ctor.state.sliderPosition * itemWidth);
                track.style.transform = `translateX(${translateX}px)`;
                
                // Update slider buttons
                ctor.updateSliderButtons();
            },
            
            updateSliderState: () => {
                const track = document.getElementById('newProductsTrack');
                if (!track) return;
                
                const items = track.children;
                const itemsCount = items.length;
                
                if (itemsCount === 0) return;
                
                const itemWidth = items[0].offsetWidth + 20;
                const containerWidth = track.parentElement.offsetWidth;
                const itemsPerView = Math.floor(containerWidth / itemWidth);
                
                // Show/hide slider buttons
                const prevBtn = document.getElementById('newProductsPrev');
                const nextBtn = document.getElementById('newProductsNext');
                
                if (prevBtn && nextBtn) {
                    if (itemsCount <= itemsPerView) {
                        prevBtn.style.display = 'none';
                        nextBtn.style.display = 'none';
                    } else {
                        prevBtn.style.display = 'block';
                        nextBtn.style.display = 'block';
                        ctor.updateSliderButtons();
                    }
                }
            },
            
            updateSliderButtons: () => {
                const track = document.getElementById('newProductsTrack');
                const prevBtn = document.getElementById('newProductsPrev');
                const nextBtn = document.getElementById('newProductsNext');
                
                if (!track || !prevBtn || !nextBtn) return;
                
                const items = track.children;
                const itemsCount = items.length;
                
                if (itemsCount === 0) return;
                
                const itemWidth = items[0].offsetWidth + 20;
                const containerWidth = track.parentElement.offsetWidth;
                const itemsPerView = Math.floor(containerWidth / itemWidth);
                const maxPosition = Math.max(0, itemsCount - itemsPerView);
                
                // Update button states
                prevBtn.disabled = ctor.state.sliderPosition === 0;
                nextBtn.disabled = ctor.state.sliderPosition >= maxPosition;
                
                prevBtn.classList.toggle('disabled', ctor.state.sliderPosition === 0);
                nextBtn.classList.toggle('disabled', ctor.state.sliderPosition >= maxPosition);
            },
            
            addTouchSupport: (element) => {
                if (!element) return;
                
                let startX = 0;
                let startY = 0;
                let distX = 0;
                let distY = 0;
                
                element.addEventListener('touchstart', (e) => {
                    const touch = e.touches[0];
                    startX = touch.clientX;
                    startY = touch.clientY;
                });
                
                element.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                });
                
                element.addEventListener('touchend', (e) => {
                    const touch = e.changedTouches[0];
                    distX = touch.clientX - startX;
                    distY = touch.clientY - startY;
                    
                    // Check if it's a horizontal swipe
                    if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > 50) {
                        if (distX > 0) {
                            ctor.slideProducts('prev');
                        } else {
                            ctor.slideProducts('next');
                        }
                    }
                });
            },
            
            // ================================
            // ANIMATION METHODS
            // ================================
            
            initializeScrollAnimations: () => {
                // Add scroll animations using CSS classes
                const animatedElements = document.querySelectorAll('.home-section');
                
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('animate-in');
                        }
                    });
                }, {
                    threshold: 0.1,
                    rootMargin: '0px 0px -50px 0px'
                });
                
                animatedElements.forEach(el => observer.observe(el));
            },
            
            animateStats: () => {
                const statNumbers = document.querySelectorAll('.stat-number');
                
                statNumbers.forEach(stat => {
                    const target = parseInt(stat.dataset.target) || 0;
                    const increment = target / 100;
                    let current = 0;
                    
                    const timer = setInterval(() => {
                        current += increment;
                        
                        if (current >= target) {
                            current = target;
                            clearInterval(timer);
                        }
                        
                        // Format number based on value
                        if (target > 100) {
                            stat.textContent = Math.floor(current).toLocaleString();
                        } else {
                            stat.textContent = current.toFixed(1);
                        }
                    }, 20);
                });
            },
            
            animateAddToCart: (button) => {
                if (!button) return;
                button = button[0];
                
                // Animate to cart
                const cartIcon = document.querySelector('.nav-cart');
                if (cartIcon) {
                    setTimeout(() => {
                        button.classList.remove('animate-add-to-cart');
                    }, 800);
                }
            },
            
            animateWishlist: (button) => {
                if (!button) return;
                button = button[0];
                
                button.classList.add('animate-wishlist');
                
                setTimeout(() => {
                    button.classList.remove('animate-wishlist');
                }, 600);
            },
            
            // ================================
            // UTILITY METHODS
            // ================================
            
            removeSkeletonLoading: () => {
                const skeletons = document.querySelectorAll('.skeleton-container');
                skeletons.forEach(skeleton => {
                    skeleton.style.opacity = '0';
                    setTimeout(() => {
                        skeleton.remove();
                    }, 300);
                });
            },
            
            createEmptyState: (message) => {
                return `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-box-open"></i>
                        </div>
                        <p class="empty-message">${message}</p>
                    </div>
                `;
            },
            
            createQuickViewContent: (product) => {
                const imageUrl = product.primary_image || '/static/images/placeholder-product.jpg';
                const stars = ctor.generateStars(product.avg_rating || 0);
                const discountPercent = ctor.calculateDiscount(product.price, product.compare_at_price);
                
                return `
                    <div class="quick-view-content">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="product-images">
                                    <img src="${imageUrl}" alt="${product.name}" class="main-image" />
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="product-details">
                                    <h2 class="product-title">${product.name}</h2>
                                    <div class="product-rating">
                                        <div class="stars">${stars}</div>
                                        <span class="review-count">(${product.review_count || 0} avaliações)</span>
                                    </div>
                                    <div class="product-price">
                                        <span class="price-current">${utils.formatPrice(product.price)}</span>
                                        ${product.compare_at_price && product.compare_at_price > product.price ? 
                                            `<span class="price-old">${utils.formatPrice(product.compare_at_price)}</span>
                                            <span class="discount-badge">-${discountPercent}%</span>` : ''
                                        }
                                    </div>
                                    <div class="product-description">
                                        <p>${product.short_description || 'Sem descrição disponível'}</p>
                                    </div>
                                    <div class="product-actions">
                                        <button class="btn btn-primary btn-add-cart" 
                                                data-product-id="${product.id}">
                                            <i class="fas fa-shopping-cart me-2"></i>
                                            Adicionar ao Carrinho
                                        </button>
                                        <button class="btn btn-outline-secondary btn-wishlist" 
                                                data-product-id="${product.id}">
                                            <i class="fas fa-heart me-2"></i>
                                            Favoritar
                                        </button>
                                    </div>
                                    <div class="product-meta">
                                        <p><strong>SKU:</strong> ${product.sku}</p>
                                        <p><strong>Categoria:</strong> ${product.category_name}</p>
                                        ${product.brand_name ? `<p><strong>Marca:</strong> ${product.brand_name}</p>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            },
            
            setupQuickViewInteractions: (product) => {
                const modal = document.getElementById('quickViewModal');
                
                // Setup add to cart in modal
                const addToCartBtn = modal.querySelector('.btn-add-cart');
                if (addToCartBtn) {
                    addToCartBtn.addEventListener('click', () => {
                        ctor.addToCart(product.id, addToCartBtn);
                    });
                }
                
                // Setup wishlist in modal
                const wishlistBtn = modal.querySelector('.btn-wishlist');
                if (wishlistBtn) {
                    wishlistBtn.addEventListener('click', () => {
                        ctor.toggleWishlist(product.id, wishlistBtn);
                    });
                }
            },
            
            // ================================
            // HELPER METHODS
            // ================================
            
            calculateDiscount: (price, comparePrice) => {
                if (!comparePrice || comparePrice <= price) return 0;
                return Math.round(((comparePrice - price) / comparePrice) * 100);
            },
            
            generateStars: (rating) => {
                const fullStars = Math.floor(rating);
                const hasHalfStar = rating % 1 !== 0;
                const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
                
                let stars = '';
                
                for (let i = 0; i < fullStars; i++) {
                    stars += '<i class="fas fa-star"></i>';
                }
                
                if (hasHalfStar) {
                    stars += '<i class="fas fa-star-half-alt"></i>';
                }
                
                for (let i = 0; i < emptyStars; i++) {
                    stars += '<i class="far fa-star"></i>';
                }
                
                return stars;
            },
            
            validateEmail: (email) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(email);
            },
            
            updateCarouselIndicators: (activeIndex) => {
                const indicators = document.querySelectorAll('.carousel-indicators button');
                indicators.forEach((indicator, index) => {
                    indicator.classList.toggle('active', index === activeIndex);
                });
            },
            
        };
    }
);
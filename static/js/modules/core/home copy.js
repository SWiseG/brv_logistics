define('/static/js/modules/home/home.script.js', null, 
    function HomeScript() {
        
        // Private variables
        let currentSlide = 0;
        let slideInterval;
        let isLoading = false;
        
        return {
            name: 'HomeScript',
            kind: bindings.observable('module'),
            modules: bindings.observable(null),
            
            compositionComplete: (name, path, dependencies, callback, params) => {
                console.log('HomeScript initialized');
                
                // Initialize all components
                ctor.initializeHeroSlider();
                ctor.loadCategories();
                ctor.loadFeaturedProducts();
                ctor.loadDeals();
                ctor.loadNewArrivals();
                ctor.initializeNewsletterForm();
                ctor.initializeScrollEffects();
                ctor.initializeProductActions();
                
                return true;
            },
            
            // ================================
            // HERO SLIDER METHODS
            // ================================
            
            initializeHeroSlider() {
                const slides = document.querySelectorAll('.hero-slide');
                const indicators = document.querySelectorAll('.hero-indicator');
                
                if (slides.length === 0) return;
                
                // Auto-slide every 5 seconds
                slideInterval = setInterval(() => {
                    ctor.nextSlide();
                }, 5000);
                
                // Pause on hover
                const heroSection = document.getElementById('heroSection');
                heroSection.addEventListener('mouseenter', () => {
                    clearInterval(slideInterval);
                });
                
                heroSection.addEventListener('mouseleave', () => {
                    slideInterval = setInterval(() => {
                        ctor.nextSlide();
                    }, 5000);
                });
                
                console.log('Hero slider initialized');
            },
            
            nextSlide() {
                const slides = document.querySelectorAll('.hero-slide');
                currentSlide = (currentSlide + 1) % slides.length;
                ctor.updateSlide();
            },
            
            previousSlide() {
                const slides = document.querySelectorAll('.hero-slide');
                currentSlide = (currentSlide - 1 + slides.length) % slides.length;
                ctor.updateSlide();
            },
            
            goToSlide(index) {
                currentSlide = index;
                ctor.updateSlide();
            },
            
            updateSlide() {
                const slides = document.querySelectorAll('.hero-slide');
                const indicators = document.querySelectorAll('.hero-indicator');
                
                slides.forEach((slide, index) => {
                    slide.classList.toggle('active', index === currentSlide);
                });
                
                indicators.forEach((indicator, index) => {
                    indicator.classList.toggle('active', index === currentSlide);
                });
            },
            
            async loadFeaturedProducts() {
                try {
                    const response = await fetch('/api/products/featured/');
                    const products = await response.json();
                    
                    const grid = document.getElementById('featuredGrid');
                    grid.innerHTML = '';
                    
                    if (products.length === 0) {
                        grid.innerHTML = '<div class="col-12 text-center"><p>Nenhum produto em destaque</p></div>';
                        return;
                    }
                    
                    products.forEach(product => {
                        const productCard = ctor.createProductCard(product);
                        grid.appendChild(productCard);
                    });
                    
                    console.log('Featured products loaded:', products.length);
                } catch (error) {
                    console.error('Error loading featured products:', error);
                    ctor.showError('Erro ao carregar produtos em destaque');
                }
            },
            
            async loadDeals() {
                try {
                    const response = await fetch('/api/products/deals/');
                    const products = await response.json();
                    
                    const grid = document.getElementById('dealsGrid');
                    grid.innerHTML = '';
                    
                    if (products.length === 0) {
                        grid.innerHTML = '<div class="col-12 text-center"><p>Nenhuma oferta disponível</p></div>';
                        return;
                    }
                    
                    products.forEach(product => {
                        const productCard = ctor.createProductCard(product, true);
                        grid.appendChild(productCard);
                    });
                    
                    console.log('Deals loaded:', products.length);
                } catch (error) {
                    console.error('Error loading deals:', error);
                    ctor.showError('Erro ao carregar ofertas');
                }
            },
            
            async loadNewArrivals() {
                try {
                    const response = await fetch('/api/products/new-arrivals/');
                    const products = await response.json();
                    
                    const grid = document.getElementById('newArrivalsGrid');
                    grid.innerHTML = '';
                    
                    if (products.length === 0) {
                        grid.innerHTML = '<div class="col-12 text-center"><p>Nenhuma novidade disponível</p></div>';
                        return;
                    }
                    
                    products.forEach(product => {
                        const productCard = ctor.createProductCard(product, false, true);
                        grid.appendChild(productCard);
                    });
                    
                    console.log('New arrivals loaded:', products.length);
                } catch (error) {
                    console.error('Error loading new arrivals:', error);
                    ctor.showError('Erro ao carregar novidades');
                }
            },
            
            // ================================
            // CARD CREATION METHODS
            // ================================
            
            createCategoryCard(category) {
                const col = document.createElement('div');
                col.className = 'col-lg-2 col-md-3 col-sm-4 col-6 mb-4';
                
                col.innerHTML = `
                    <a href="/produtos/categoria/${category.slug}/" class="text-decoration-none">
                        <div class="category-card">
                            <img src="${category.image || '/static/images/no-image.png'}" 
                                 alt="${category.name}" 
                                 class="category-image">
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
            
            createProductCard(product, isDeal = false, isNew = false) {
                const col = document.createElement('div');
                col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
                
                // Calculate discount percentage
                const discountPercent = product.compare_at_price && product.compare_at_price > product.price 
                    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
                    : 0;
                
                // Generate stars
                const stars = ctor.generateStars(product.avg_rating || 0);
                
                // Badge logic
                let badge = '';
                if (isNew) {
                    badge = '<span class="product-badge new">Novo</span>';
                } else if (isDeal && discountPercent > 0) {
                    badge = '<span class="product-badge sale">Oferta</span>';
                }
                
                col.innerHTML = `
                    <div class="product-card" data-product-id="${product.id}">
                        <div class="product-image">
                            <img src="${product.image || '/static/images/no-image.png'}" 
                                 alt="${product.name}" 
                                 loading="lazy">
                            ${badge}
                            <button class="product-wishlist" 
                                    data-product-id="${product.id}" 
                                    title="Adicionar à lista de desejos">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                        <div class="product-info">
                            <div class="product-category">${product.category || 'Sem categoria'}</div>
                            <h3 class="product-title">
                                <a href="/produtos/produto/${product.slug}/" class="text-decoration-none text-dark">
                                    ${product.name}
                                </a>
                            </h3>
                            <div class="product-rating">
                                <div class="stars">${stars}</div>
                                <span class="rating-count">(${product.review_count || 0})</span>
                            </div>
                            <div class="product-price">
                                <span class="price-current">R$ ${ctor.formatPrice(product.price)}</span>
                                ${product.compare_at_price && product.compare_at_price > product.price ? 
                                    `<span class="price-old">R$ ${ctor.formatPrice(product.compare_at_price)}</span>
                                     <span class="price-discount">-${discountPercent}%</span>` : ''}
                            </div>
                            <div class="product-actions">
                                <button class="btn btn-cart" 
                                        data-product-id="${product.id}"
                                        onclick="ctor.addToCart(${product.id})">
                                    <i class="fas fa-shopping-cart me-2"></i>
                                    Comprar
                                </button>
                                <button class="btn btn-quick-view" 
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
            
            // ================================
            // PRODUCT INTERACTION METHODS
            // ================================
            
            initializeProductActions() {
                // Wishlist buttons
                document.addEventListener('click', (e) => {
                    if (e.target.closest('.product-wishlist')) {
                        const button = e.target.closest('.product-wishlist');
                        const productId = button.dataset.productId;
                        ctor.toggleWishlist(productId, button);
                    }
                });
                
                // Product card hover effects
                document.addEventListener('mouseenter', (e) => {
                    if (e.target.closest('.product-card')) {
                        const card = e.target.closest('.product-card');
                        ctor.onProductCardHover(card);
                    }
                }, true);
                
                console.log('Product actions initialized');
            },
            
            async addToCart(productId) {
                if (isLoading) return;
                
                isLoading = true;
                
                try {
                    const response = await fetch('/pedidos/carrinho/adicionar/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': ctor.getCsrfToken()
                        },
                        body: JSON.stringify({
                            product_id: productId,
                            quantity: 1
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update cart count
                        if (window.navbarManager) {
                            window.navbarManager.updateCartCount(data.cart_count);
                        }
                        
                        // Show success message
                        ctor.showNotification('Produto adicionado ao carrinho!', 'success');
                        
                        // Animate button
                        const button = document.querySelector(`[data-product-id="${productId}"].btn-cart`);
                        if (button) {
                            ctor.animateAddToCart(button);
                        }
                        
                    } else {
                        throw new Error(data.message || 'Erro ao adicionar ao carrinho');
                    }
                    
                } catch (error) {
                    console.error('Error adding to cart:', error);
                    ctor.showNotification('Erro ao adicionar produto ao carrinho', 'error');
                } finally {
                    isLoading = false;
                }
            },
            
            async toggleWishlist(productId, button) {
                if (isLoading) return;
                
                isLoading = true;
                
                try {
                    const response = await fetch('/marketing/lista-desejos/toggle/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': ctor.getCsrfToken()
                        },
                        body: JSON.stringify({
                            product_id: productId
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update wishlist count
                        if (window.navbarManager) {
                            window.navbarManager.updateWishlistCount(data.wishlist_count);
                        }
                        
                        // Update button state
                        const icon = button.querySelector('i');
                        if (data.added) {
                            icon.style.color = '#e74c3c';
                            button.style.background = 'rgba(231, 76, 60, 0.1)';
                            ctor.showNotification('Produto adicionado à lista de desejos!', 'success');
                        } else {
                            icon.style.color = '#666';
                            button.style.background = 'rgba(255, 255, 255, 0.9)';
                            ctor.showNotification('Produto removido da lista de desejos!', 'info');
                        }
                        
                        // Animate button
                        ctor.animateWishlist(button);
                        
                    } else {
                        throw new Error(data.message || 'Erro ao atualizar lista de desejos');
                    }
                    
                } catch (error) {
                    console.error('Error toggling wishlist:', error);
                    ctor.showNotification('Erro ao atualizar lista de desejos', 'error');
                } finally {
                    isLoading = false;
                }
            },
            
            quickView(productId) {
                // Open quick view modal
                // This would integrate with a modal system
                console.log('Quick view for product:', productId);
                
                // For now, redirect to product page
                window.location.href = `/produtos/produto/${productId}/`;
            },
            
            onProductCardHover(card) {
                // Add hover effects or lazy load additional images
                const image = card.querySelector('.product-image img');
                if (image.dataset.hoverSrc) {
                    const originalSrc = image.src;
                    image.src = image.dataset.hoverSrc;
                    
                    card.addEventListener('mouseleave', () => {
                        image.src = originalSrc;
                    }, { once: true });
                }
            },
            
            // ================================
            // NEWSLETTER FORM
            // ================================
            
            initializeNewsletterForm() {
                const form = document.getElementById('newsletterForm');
                if (!form) return;
                
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const formData = new FormData(form);
                    const email = formData.get('email');
                    
                    if (!email || !ctor.validateEmail(email)) {
                        ctor.showNotification('Digite um e-mail válido', 'error');
                        return;
                    }
                    
                    try {
                        const response = await fetch('/marketing/newsletter/subscribe/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': ctor.getCsrfToken()
                            },
                            body: JSON.stringify({ email })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            ctor.showNotification('E-mail cadastrado com sucesso!', 'success');
                            form.reset();
                        } else {
                            throw new Error(data.message || 'Erro ao cadastrar e-mail');
                        }
                        
                    } catch (error) {
                        console.error('Error subscribing to newsletter:', error);
                        ctor.showNotification('Erro ao cadastrar e-mail', 'error');
                    }
                });
                
                console.log('Newsletter form initialized');
            },
            
            // ================================
            // SCROLL EFFECTS
            // ================================
            
            initializeScrollEffects() {
                // Intersection Observer for animations
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
                
                // Observe all sections
                document.querySelectorAll('.home-section').forEach(section => {
                    observer.observe(section);
                });
                
                // Parallax effect for hero section
                window.addEventListener('scroll', () => {
                    const scrolled = window.pageYOffset;
                    const heroSection = document.getElementById('heroSection');
                    if (heroSection) {
                        heroSection.style.transform = `translateY(${scrolled * 0.5}px)`;
                    }
                });
                
                console.log('Scroll effects initialized');
            },
            
            // ================================
            // UTILITY METHODS
            // ================================
            validateEmail(email) {
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return re.test(email);
            },
            
            animateAddToCart(button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check me-2"></i>Adicionado!';
                button.style.background = 'linear-gradient(45deg, #2ecc71, #27ae60)';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
                }, 2000);
            },
            
            animateWishlist(button) {
                button.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 200);
            },
        
        };
    }
);
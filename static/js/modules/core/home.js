define(`/static/js/modules/core/home.js`, ['/static/js/mixins/components.js', `/static/js/modules/navbar.js`], 
    function Home() {
        return {
            name: `Home`,
            kind: bindings.observable(`module`),
            modules: bindings.observable([]),
            heroCarouselPrevClass: 'carousel-control-prev',
            heroCarouselNextClass: 'carousel-control-next',
            compositionComplete: async (name, path, dependencies, callback, params) => {
                ctor.carrouselInit();
                await ctor.loadCategories();
                await ctor.loadFeaturedProducts();
                ctor.applyLazyLoadingImages();
                return bindings.reload();
            },

            carrouselInit: () => {
                // Initialize carousel with custom options
                var $carouselContainer = $('#heroCarousel');
                if($carouselContainer && $carouselContainer?.length > 0) {
                    const heroCarousel = new bootstrap.Carousel($carouselContainer[0], {
                        interval: 5000, // 5 seconds
                        wrap: true,
                        touch: true
                    });

                    // Appending Events
                    const heroId = $carouselContainer.attr('id');
                    const expressionFinderByAttr = '[data-bs-target="#'+ heroId +'"]';
                    
                    const $previous = $carouselContainer.find('.' + ctor.heroCarouselPrevClass + expressionFinderByAttr);
                    const $next = $carouselContainer.find('.' + ctor.heroCarouselNextClass + expressionFinderByAttr);
                    
                    if($previous?.length > 0) $previous.on('click', (e) => {
                        return heroCarousel.prev();
                    });
                    if($next?.length > 0) $next.on('click', (e) => {
                        return heroCarousel.next();
                    });

                    const $indicators = $carouselContainer.find('.carousel-indicators');
                    if($indicators?.length > 0) {
                        $indicators.children().each((i, btn) => {
                            var _self = $(btn);
                            
                            _self.on('click', (e) => {
                                var $currentTarget = $(e.currentTarget);
                                var slideTargetIndex = $currentTarget.attr('data-bs-slide-to') || 0;
                                return heroCarousel.to(slideTargetIndex);
                            });
                        });
                    };
                };
            },

            applyLazyLoadingImages: () => {
                // Lazy loading for images
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
            },

            // ================================
            // CONTENT LOADING METHODS
            // ================================
            
            loadCategories: async () => {
                try {
                    const response = await fetch(`${global.config.apiUrl}categories/`);
                    const categories = await response.json();
                    
                    const grid = document.getElementById('categoriesGrid');
                    grid.innerHTML = '';
                    
                    if (categories.results.length !== 0) {
                        categories.results.forEach(category => {
                            const categoryCard = ctor.createCategoryCard(category);
                            grid.appendChild(categoryCard);
                        });
                    }
                    else return grid.innerHTML = '<div class="no-content-drop col-12 text-center"><p>Nenhuma categoria encontrada</p></div>';
                } catch (error) {
                    console.error('Error loading categories:', error);
                    notify.show('Erro ao carregar categorias', 'error');
                }
            },

            loadFeaturedProducts: async () => {
                try {
                    const response = await fetch(`${global.config.apiUrl}products/featured/`);
                    const products = await response.json();
                    
                    const grid = document.getElementById('featuredGrid');
                    grid.innerHTML = '';
                    
                    if (products.length !== 0) {
                        products.forEach(product => {
                            const productCard = ctor.createProductCard(product);
                            grid.appendChild(productCard);
                        });
                    }
                    else return grid.innerHTML = '<div class="no-content-drop col-12 text-center"><p>Nenhuma produto em destaque encontrado</p></div>';
                } catch (error) {
                    console.error('Error loading featured products:', error);
                    ctor.showError('Erro ao carregar produtos em destaque');
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
                                    `<span class="price-current">R$ ${ctor.formatPrice(product.compare_at_price)}</span>
                                        ${product.compare_at_price && product.compare_at_price > product.price ? 
                                            `<span class="price-old">R$ ${ctor.formatPrice(product.price)}</span>
                                            <span class="price-discount">${discountPercent}%</span>` : ''}
                                    `
                                    :
                                    `<span class="price-current">R$ ${ctor.formatPrice(product.price)}</span>`
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

            // ================================
            // PRODUCT INTERACTION METHODS
            // ================================
            
            async addToCart(params) {
                var productId = params.$element.attr('data-product-id');

                if(!productId) return;
                
                utils.loading();

                try {
                    const response = await fetch('/pedidos/carrinho/adicionar/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': global.options.csrfToken
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
                    utils.loading(false);
                }
            },
            
            toggleWishlist: async (params) => {
                debugger;
                var button, productId;
                
                if (params.$element.is(`button`) && params.$element.hasClass('product-wishlist')) {
                    button = params.$element;
                    productId = button.data().productId;
                };

                if (!button || !productId) return;

                utils.loading();
                
                try {
                    const response = await fetch(`${global.config.apiUrl}marketing/lista-desejos/toggle/`, {
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
                    utils.loading(false);
                }
            },
            
            quickView(productId) {
                // Open quick view modal
                // This would integrate with a modal system
                console.log('Quick view for product:', productId);
                
                // For now, redirect to product page
                window.location.href = `/produtos/produto/${productId}/`;
            },

            // ================================
            // UTILITY METHODS
            // ================================
            
            formatPrice(price) {
                return parseFloat(price).toFixed(2).replace('.', ',');
            },
            
            generateStars(rating) {
                const fullStars = Math.floor(rating);
                const hasHalfStar = rating % 1 !== 0;
                const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
                
                let stars = '';
                
                // Full stars
                for (let i = 0; i < fullStars; i++) {
                    stars += '<i class="fas fa-star"></i>';
                }
                
                // Half star
                if (hasHalfStar) {
                    stars += '<i class="fas fa-star-half-alt"></i>';
                }
                
                // Empty stars
                for (let i = 0; i < emptyStars; i++) {
                    stars += '<i class="far fa-star"></i>';
                }
                
                return stars;
            },
        }
    }
)
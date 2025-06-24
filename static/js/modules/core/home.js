define(`/static/js/modules/core/home.js`, '/static/js/mixins/components.js', 
    function Home() {
        return {
            name: `Home`,
            kind: bindings.observable(`module`),
            modules: bindings.observable([]),
            
            heroCarouselPrevClass: 'carousel-control-prev',
            heroCarouselNextClass: 'carousel-control-next',
            compositionComplete: (name, path, dependencies, callback, params) => {
                ctor.carrouselInit();
                ctor.newsLetterFormSend();
                ctor.applyLazyLoadingImages();
                ctor.applyOptionsProducts();
                var field1 = ctor.createField({
                    type: 'combobox',
                    id: 'category-combobox',
                    label: 'Categoria',
                    placeholder: 'Selecione a categoria...',
                    comboboxOptions: {
                        endPoint: 'categories',
                        textField: 'name',
                        valField: 'id'
                    }
                });
                var field2 = ctor.createField({
                    type: 'combobox',
                    id: 'category-combobox-2',
                    label: 'Categoria 2',
                    placeholder: 'Selecione a categoria 2...',
                    comboboxOptions: {
                        endPoint: 'categories',
                        textField: 'name',
                        valField: 'id'
                    },
                    cascadeFrom: ['category-combobox']
                });
                $('.block-elem').append(field1);
                $('.block-elem').append(field2);
                // var textField = ctor.createField({label: 'Nome', placeholder: 'Digite seu nome...'});
                // var textField2 = ctor.createField({label: 'Sobrenome', placeholder: 'Digite seu sobrenome...'});
                // var textField3 = ctor.createField({type: 'cpf', label: 'CPF', placeholder: 'Digite seu CPF...'});
                // var textField4 = ctor.createField({
                //     type: 'numeric',
                //     label: 'Numeric Field',
                //     placeholder: 'Enter a number',
                //     container: '.block-elem'
                // });
                // var textField5 = ctor.createField({
                //     type: 'email',
                //     label: 'Email Field',
                //     placeholder: 'Digite um email...',
                //     container: '.block-elem'
                // });
                // var textField5 = ctor.createField({
                //     type: 'currency',
                //     label: 'Currency Field',
                //     placeholder: 'R$ 0,00',
                //     container: '.block-elem'
                // });
                // var textField6 = ctor.createField({
                //     type: 'time',
                //     label: 'Time Field',
                //     placeholder: 'HH:MM',
                //     container: '.block-elem'
                // });
                // var textField7 = ctor.createField({
                //     type: 'date',
                //     label: 'Date Field',
                //     container: '.block-elem'
                // });
                // var textField8 = ctor.createField({
                //     type: 'datetime',
                //     label: 'DateTime Field',
                //     container: '.block-elem'
                // });
                // var textField10 = ctor.createField({
                //     type: 'betweenDates',
                //     id: 'between_dates_field',
                //     label: 'Between Dates',
                //     container: '.block-elem'
                // });
                // var textField11 = ctor.createField({
                //     type: 'dropdown',
                //     id: 'estadoCivilDropdown',
                //     label: 'Estado Civil',
                //     placeholder: 'Selecione...',
                //     options: [
                //         { label: 'Solteiro', value: 'solteiro' },
                //         { label: 'Casado', value: 'casado' },
                //         { label: 'Divorciado', value: 'divorciado' }
                //     ],
                //     useBindings: true
                // });
                // var textField12 = ctor.createField({
                //     type: 'combobox',
                //     id: 'categoriaCombobox',
                //     label: 'Categoria',
                //     placeholder: 'Digite o nome da categoria...',
                //     minSearchLenght: 2,
                //     debounceDelay: 300,
                //     fetchOptions: (query, dropdown, input) => {
                //         return new Promise((resolve, reject) => {
                //             const url = query && query.length > 0
                //                 ? `/api/v1/categories/?format=json&search=${encodeURIComponent(query)}`
                //                 : `/api/v1/categories/?format=json`;

                //             $.ajax({
                //                 url: url,
                //                 method: 'GET',
                //                 dataType: 'json',
                //                 success: function(response) {
                //                     const items = (response.results || []).map(categoria => ({
                //                         label: categoria.name,
                //                         value: categoria.id
                //                     }));
                //                     resolve(items);
                //                 },
                //                 error: function() {
                //                     reject();
                //                 }
                //             });
                //         });
                //     },
                //     useBindings: true
                // });
                return true;
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

            newsLetterFormSend: () => {
                // Newsletter form submission
                const newsletterForm = document.querySelector('.newsletter-form');
                if (newsletterForm) {
                    newsletterForm.addEventListener('submit', function(e) {
                        e.preventDefault();
                        const email = this.querySelector('input[name="email"]').value;
                        
                        // Simple validation
                        if (validateEmail(email)) {
                            // Here you would send to your backend
                            showToast('Email cadastrado com sucesso!', 'success');
                            this.reset();
                        } else {
                            showToast('Por favor, insira um email válido.', 'error');
                        }
                    });
                }
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

            applyOptionsProducts: () => {
                // Product card animations on scroll
                const observerOptions = {
                    threshold: 0.1,
                    rootMargin: '0px 0px -50px 0px'
                };

                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('fade-in');
                        }
                    });
                }, observerOptions);

                // Observe all product cards
                document.querySelectorAll('.product-card, .category-card, .offer-card').forEach(card => {
                    observer.observe(card);
                });
            },

            // Add to Cart Function
            addToCart: (productId, quantity = 1) => {
                // Show loading state
                const button = event.target.closest('button');
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                button.disabled = true;

                // AJAX request to add to cart
                fetch('/api/cart/add/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': global.getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        product_id: productId,
                        quantity: quantity
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Update cart count in header
                        updateCartCount(data.cart_count);
                        showToast('Produto adicionado ao carrinho!', 'success');
                        
                        // Animate button
                        button.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            button.innerHTML = originalText;
                            button.disabled = false;
                        }, 1500);
                    } else {
                        showToast(data.message || 'Erro ao adicionar produto', 'error');
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Erro ao adicionar produto ao carrinho', 'error');
                    button.innerHTML = originalText;
                    button.disabled = false;
                });
            },

            // Add to Wishlist Function
            addToWishlist: (productId) => {
                const button = event.target.closest('button');
                const icon = button.querySelector('i');
                
                fetch('/api/wishlist/add/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': global.getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        product_id: productId
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Toggle heart icon
                        if (data.added) {
                            icon.classList.remove('far');
                            icon.classList.add('fas');
                            button.classList.remove('btn-outline-secondary');
                            button.classList.add('btn-danger');
                            showToast('Produto adicionado aos favoritos!', 'success');
                        } else {
                            icon.classList.remove('fas');
                            icon.classList.add('far');
                            button.classList.remove('btn-danger');
                            button.classList.add('btn-outline-secondary');
                            showToast('Produto removido dos favoritos', 'info');
                        }
                    } else {
                        showToast(data.message || 'Erro ao processar favorito', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Erro ao processar favorito', 'error');
                });
            }

        }
    }
)


// // Quick View Function
// function quickView(productId) {
//     // Show loading modal
//     showLoadingModal();
    
//     fetch(`/api/products/${productId}/quick-view/`)
//     .then(response => response.text())
//     .then(html => {
//         // Create and show modal with product details
//         const modal = document.createElement('div');
//         modal.innerHTML = html;
//         document.body.appendChild(modal);
        
//         const quickViewModal = new bootstrap.Modal(modal.querySelector('.modal'));
//         quickViewModal.show();
        
//         // Remove modal from DOM when closed
//         modal.addEventListener('hidden.bs.modal', () => {
//             document.body.removeChild(modal);
//         });
//     })
//     .catch(error => {
//         console.error('Error:', error);
//         showToast('Erro ao carregar produto', 'error');
//     });
// }

// // Update Cart Count in Header
// function updateCartCount(count) {
//     const cartBadge = document.querySelector('.fa-shopping-cart + .badge');
//     if (cartBadge) {
//         cartBadge.textContent = count;
        
//         // Animate badge
//         cartBadge.classList.add('animate-pulse');
//         setTimeout(() => {
//             cartBadge.classList.remove('animate-pulse');
//         }, 1000);
//     }
// }

// // Email Validation
// function validateEmail(email) {
//     const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     return re.test(email);
// }


// // Search functionality
// function initializeSearch() {
//     const searchForm = document.querySelector('.search-form');
//     const searchInput = searchForm.querySelector('input[type="search"]');
    
//     // Add search suggestions
//     let searchTimeout;
//     searchInput.addEventListener('input', function() {
//         clearTimeout(searchTimeout);
//         const query = this.value.trim();
        
//         if (query.length > 2) {
//             searchTimeout = setTimeout(() => {
//                 fetchSearchSuggestions(query);
//             }, 300);
//         } else {
//             hideSearchSuggestions();
//         }
//     });
    
//     // Handle search form submission
//     searchForm.addEventListener('submit', function(e) {
//         e.preventDefault();
//         const query = searchInput.value.trim();
//         if (query) {
//             window.location.href = `/produtos/?q=${encodeURIComponent(query)}`;
//         }
//     });
// }

// // Fetch Search Suggestions
// function fetchSearchSuggestions(query) {
//     fetch(`/api/search/suggestions/?q=${encodeURIComponent(query)}`)
//     .then(response => response.json())
//     .then(data => {
//         showSearchSuggestions(data.suggestions);
//     })
//     .catch(error => {
//         console.error('Search error:', error);
//     });
// }

// // Show Search Suggestions
// function showSearchSuggestions(suggestions) {
//     // Remove existing suggestions
//     const existingSuggestions = document.querySelector('.search-suggestions');
//     if (existingSuggestions) {
//         existingSuggestions.remove();
//     }
    
//     if (suggestions.length === 0) return;
    
//     const searchForm = document.querySelector('.search-form');
//     const suggestionsDiv = document.createElement('div');
//     suggestionsDiv.className = 'search-suggestions';
//     suggestionsDiv.style.cssText = `
//         position: absolute;
//         top: 100%;
//         left: 0;
//         right: 0;
//         background: white;
//         border: 1px solid #ddd;
//         border-top: none;
//         max-height: 300px;
//         overflow-y: auto;
//         z-index: 1000;
//         box-shadow: 0 4px 6px rgba(0,0,0,0.1);
//     `;
    
//     suggestions.forEach(suggestion => {
//         const item = document.createElement('div');
//         item.className = 'suggestion-item';
//         item.style.cssText = `
//             padding: 10px 15px;
//             cursor: pointer;
//             border-bottom: 1px solid #eee;
//         `;
//         item.textContent = suggestion.name;
//         item.addEventListener('click', () => {
//             window.location.href = `/produto/${suggestion.slug}/`;
//         });
//         item.addEventListener('mouseenter', () => {
//             item.style.backgroundColor = '#f8f9fa';
//         });
//         item.addEventListener('mouseleave', () => {
//             item.style.backgroundColor = 'white';
//         });
        
//         suggestionsDiv.appendChild(item);
//     });
    
//     searchForm.style.position = 'relative';
//     searchForm.appendChild(suggestionsDiv);
// }

// // Hide Search Suggestions
// function hideSearchSuggestions() {
//     const suggestions = document.querySelector('.search-suggestions');
//     if (suggestions) {
//         suggestions.remove();
//     }
// }

// // Initialize search when page loads
// document.addEventListener('DOMContentLoaded', initializeSearch);

// // Close search suggestions when clicking outside
// document.addEventListener('click', function(e) {
//     if (!e.target.closest('.search-form')) {
//         hideSearchSuggestions();
//     }
// });

// // Add CSS animations
// const style = document.createElement('style');
// style.textContent = `
//     @keyframes slideInRight {
//         from {
//             transform: translateX(100%);
//             opacity: 0;
//         }
//         to {
//             transform: translateX(0);
//             opacity: 1;
//         }
//     }
    
//     @keyframes fadeOut {
//         from {
//             opacity: 1;
//         }
//         to {
//             opacity: 0;
//         }
//     }
    
//     .fade-out {
//         animation: fadeOut 0.3s ease-out forwards;
//     }
    
//     .animate-pulse {
//         animation: pulse 1s ease-in-out;
//     }
    
//     @keyframes pulse {
//         0% { transform: scale(1); }
//         50% { transform: scale(1.2); }
//         100% { transform: scale(1); }
//     }
// `;
// document.head.appendChild(style);

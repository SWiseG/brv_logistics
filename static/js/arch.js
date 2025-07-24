function Architecture() {
    return {
        name: 'Architecture',
        
        // Observer para elementos lazy
        intersectionObserver: null,
        mutationObserver: null,
        
        // Callbacks registrados
        lazyCallbacks: new Map(),
        
        init() {
            this.setupIntersectionObserver();
            this.setupMutationObserver();
            this.setupEventListeners();
            this.scanExistingElements();
        },
        
        setupIntersectionObserver() {
            if (!window.IntersectionObserver) return;
            
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.handleLazyLoad(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px', // Carregar 50px antes de aparecer
                threshold: 0.1
            });
        },
        
        setupMutationObserver() {
            this.mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            this.scanElement(node);
                        }
                    });
                });
            });
            
            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        },
        
        setupEventListeners() {
            // Lazy load por clique
            document.addEventListener('click', async (e) => {
                const lazyClick = e.target.closest('[data-lazy-click]');
                if (lazyClick) {
                    e.preventDefault();
                    await this.handleLazyLoad(lazyClick);
                }
            });
            
            // Lazy load por hover (com debounce)
            let hoverTimeout;
            document.addEventListener('mouseover', (e) => {
                const lazyHover = e.target.closest('[data-lazy-hover]');
                if (lazyHover) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = setTimeout(() => {
                        this.handleLazyLoad(lazyHover);
                    }, 200); // 200ms delay
                }
            });
        },
        
        scanExistingElements() {
            // Escanear elementos já existentes na página
            this.scanElement(document.body);
        },
        
        scanElement(element) {
            // Elementos com lazy loading
            const lazyElements = element.querySelectorAll ? 
                element.querySelectorAll('[data-lazy-module], [data-lazy-viewport]') : 
                (element.matches && element.matches('[data-lazy-module], [data-lazy-viewport]') ? [element] : []);
            
            lazyElements.forEach(el => {
                if (el.hasAttribute('data-lazy-viewport')) {
                    // Lazy load quando aparecer na viewport
                    this.intersectionObserver?.observe(el);
                } else if (el.hasAttribute('data-lazy-module')) {
                    // Lazy load manual
                    this.registerLazyElement(el);
                }
            });
        },
        
        registerLazyElement(element) {
            const moduleId = element.getAttribute('data-lazy-module');
            if (!moduleId) return;
            
            if (!this.lazyCallbacks.has(moduleId)) {
                this.lazyCallbacks.set(moduleId, new Set());
            }
            
            this.lazyCallbacks.get(moduleId).add(element);
        },
        
        async handleLazyLoad(element) {
            const moduleId = element.getAttribute('data-lazy-module') || 
                             element.getAttribute('data-lazy-viewport') ||
                             element.getAttribute('data-lazy-click') ||
                             element.getAttribute('data-lazy-hover');
            
            if (!moduleId || element.hasAttribute('data-lazy-loaded')) {
                return;
            }
            
            // Marcar como carregando
            element.setAttribute('data-lazy-loading', 'true');
            this.showLoadingState(element);
            
            try {
                // Resolver módulo usando o dependency resolver
                const module = await window.dependencyResolver.require(moduleId);
                
                // Marcar como carregado
                element.setAttribute('data-lazy-loaded', 'true');
                element.removeAttribute('data-lazy-loading');
                
                // Executar callback customizado se existir
                const callback = element.getAttribute('data-lazy-callback');
                if (callback && window[callback]) {
                    window[callback](module, element);
                }
                
                // Dispatch evento customizado
                element.dispatchEvent(new CustomEvent('lazyLoaded', {
                    detail: { module, element }
                }));
                
                this.hideLoadingState(element);
                
                if(window['logger']) logger.log(`arch loaded: ${moduleId}`, 'info');
                
            } catch (error) {
                if(window['logger']) logger.log(`Critical error on arch loading ${moduleId}:`, error, 'error');
                element.removeAttribute('data-lazy-loading');
                this.showErrorState(element, error);
            }
        },
        
        showLoadingState(element) {
            const existing = element.querySelector('.lazy-loading-indicator');
            if (existing) return;
            
            const indicator = document.createElement('div');
            indicator.className = 'lazy-loading-indicator';
            indicator.innerHTML = `
                <div class="spinner-border spinner-border-sm" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            `;
            
            element.appendChild(indicator);
        },
        
        hideLoadingState(element) {
            const indicator = element.querySelector('.lazy-loading-indicator');
            if (indicator) {
                indicator.remove();
            }
        },
        
        showErrorState(element, error) {
            this.hideLoadingState(element);
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'lazy-error-indicator alert alert-warning';
            errorDiv.innerHTML = `
                <small>Erro ao carregar: ${error.message}</small>
                <button class="btn btn-sm btn-outline-primary ms-2" onclick="this.parentElement.remove(); this.parentElement.parentElement.removeAttribute('data-lazy-loaded');">
                    Tentar novamente
                </button>
            `;
            
            element.appendChild(errorDiv);
        }
    };
}

function Global() {
    return {
        modules: [],
        translations: {},
        options: { noTreatedOptions: [] },
        messages: [],
        currentLang: 'pt-BR',
        cart: { items: [], total: 0 },
        user: { isAuthenticated: false },
        config: {
            currency: 'BRL',
            currencySymbol: 'R$',
            apiUrl: '/api/v1/',
            csrfToken: document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
        },
        
        async init() {
            this.applyHashProperties();
            await this.initMessages();
            
            if (!window.dependencyResolver) {
                window.dependencyResolver = new DependencyResolver();
            }
            
            if (!window.arch) {
                window.arch = new Architecture();
                arch.init();
            }
        },
        
        async loadModules() {
            const $modules = $('module[data-tag]');
            const modulesPaths = [];
            
            $modules.each((i, mod) => {
                const $module = $(mod);
                const dataTag = $module.attr('data-tag');
                
                if (dataTag && dataTag.trim() !== '') {
                    modulesPaths.push(dataTag.trim());
                }
            });
            
            if (modulesPaths.length === 0) {
                if(window['logger']) logger.log('No modules found to load', 'warn');
                return {};
            }
            
            const loadedModules = [];
            let finalCtor = {};
            
            for (let i = 0; i < modulesPaths.length; i++) {
                const modulePath = modulesPaths[i];
                
                try {
                    if(window['logger']) logger.log(`Binding: ${modulePath}`, 'info');
                    
                    const module = await dependencyResolver.require(modulePath);
                    
                    if (module && typeof module === 'object') {
                        loadedModules.push(module);
                        
                        finalCtor = this._mergeModuleIntoCtor(finalCtor, module);
                        
                        if(window['logger']) logger.log(`Module ${module.name || 'unnamed'} loaded successfully`, 'success');
                    }
                    
                } catch (error) {
                    if(window['logger']) logger.log(`[${i+1}/${modulesPaths.length}] Failed to load ${modulePath}:`, error, 'error');
                }
            }

            window.ctor = finalCtor;
            
            await this._executeGlobalPostLoadHooks(loadedModules);
            
            return window.ctor;
        },

        _mergeModuleIntoCtor(currentCtor, module) {
            if (!module || typeof module !== 'object') return currentCtor;

            const result = { ...currentCtor };
            
            let mergedCount = 0;
            
            for (const [key, value] of Object.entries(module)) {
                if (this._shouldSkipGlobalMerge(key)) {
                    continue;
                }
                
                const existingValue = result[key];
                
                if (existingValue === undefined) {
                    // Propriedade não existe - adicionar
                    result[key] = value;
                    mergedCount++;
                } else if (typeof value === 'object' && typeof existingValue === 'object' && 
                           value !== null && existingValue !== null && 
                           !Array.isArray(value) && !Array.isArray(existingValue)) {
                    // Ambos são objetos - merge profundo
                    result[key] = { ...existingValue, ...value };
                    mergedCount++;
                }
            }
            
            return result;
        },

        _shouldSkipGlobalMerge(key) {
            const skipKeys = [
                'constructor', 
                'prototype', 
                '__proto__',
                'name', // Cada módulo tem seu próprio nome
                'kind'  // Cada módulo tem seu próprio kind
            ];
            return skipKeys.includes(key);
        },

        async _executeGlobalPostLoadHooks(modules) {
            if(window['logger']) logger.log(`Executing global post-load hooks for ${modules.length} modules`, 'info');
            
            try {
                // Hook individual para cada módulo
                for (const module of modules) {
                    if (typeof module.allModulesLoaded === 'function') {
                        if(window['logger']) logger.log(`Executing allModulesLoaded for ${module.name || 'unnamed'}`, 'info');
                        
                        try {
                            await module.allModulesLoaded(modules);
                        } catch (error) {
                            if(window['logger']) logger.log(`Error in allModulesLoaded for ${module.name}:`, error, 'error');
                        }
                    }
                }
                
                // Hook global no ctor final
                if (window.ctor && typeof window.ctor.allModulesLoaded === 'function') {
                    if(window['logger']) logger.log('Executing global allModulesLoaded on final ctor', 'info');
                    await window.ctor.allModulesLoaded(modules);
                }
                
                if(window['logger']) logger.log('All post-load hooks executed successfully', 'success');
                
            } catch (error) {
                if(window['logger']) logger.log('Error in global post-load hooks:', error, 'error');
            }
        },
        
        registerModule(name, path, dependencies, factory, partial, params) {
            const module = {
                name,
                path,
                dependencies,
                params,
                ctor: factory,
                started: false,
                createdAt: new Date()
            };
            
            this.modules.push(module);
            return module;
        },
        
        initHtml: () => {
            $('html').removeClass('hidden-content-html');
        },
        
        async initMessages() {
            try {
                const response = await fetch('/modals/', { credentials: 'include' });
                if (response.ok) {
                    this.messages = await response.json();
                    if(window['logger']) logger.log('Messages modal initialized');
                }
            } catch (error) {
                if(window['logger']) logger.log('Messages modal initialized:', error, 'warn');
            }
        },
        
        getCookie(name) {
            let cookieValue = null;
            if (document.cookie && document.cookie !== '') {
                const cookies = document.cookie.split(';');
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i].trim();
                    if (cookie.substring(0, name.length + 1) === (name + '=')) {
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        },
        
        getCsrfToken() {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'csrftoken') {
                    return value;
                }
            }
            
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            return metaTag ? metaTag.getAttribute('content') : '';
        },

        getModule: (name) => {
            const hasLogger = window.hasOwnProperty('logger');
            
            function isInConstructor(name) { return window.ctor && window.ctor.hasOwnProperty('name') && window.ctor.name === name; };
            function isInParent(name) { return window.parent && window.parent.hasOwnProperty('name') && window.parent.name === name; };
            
            // logger.log(`Trying to find custom module constructor ${name}`, 'warn');

            if(isInConstructor(name)) {
                // logger.log(`Module constructor was in ctor`, 'warn');
                return window.ctor;
            }
            else if(isInParent(name)) {
                // logger.log(`Module constructor was in parent. Maybe any custom partial view is opened`, 'warn');
                return window.parent;
            }
            else {
                const module = global.modules.find(md => md.name === name);
                if(hasLogger) {
                    if(!module) logger.log(`Could not found custom module constructor ${name}`, 'warn');
                    else {
                        // logger.log(`Module constructor ${name} founded`, 'warn');
                        return module.ctor;
                    };
                };
            };

            return null;
        },
        
        applyHashProperties() {
            if (!this.config.csrfToken || this.config.csrfToken === "") {
                this.config.csrfToken = this.getCsrfToken();
            }
            
            const $hashOptions = $('datahash');
            $hashOptions.each((i, e) => {
                const $hash = $(e);
                const $hashVal = $hash.attr('val');
                const parsed = JSON.tryParse($hashVal);
                
                if (parsed) {
                    Object.keys(parsed).forEach((key) => {
                        const value = parsed[key];
                        this.options[key] = value === 'true' || value === 'false' ? 
                            Boolean(value) : value;
                    });
                } else {
                    this.options.noTreatedOptions.push($hashVal);
                }
            });
            $hashOptions.remove();
            
            // Check user auth
            $("script[tag='auth']").remove();
            if (window.hasOwnProperty('auth')) {
                this.user.isAuthenticated = window.auth;
                delete window.auth;
            }
        }
    };
}

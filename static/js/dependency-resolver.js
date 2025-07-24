function DependencyResolver() {
    return {
        name: 'DependencyResolver',
        
        // Cache de módulos resolvidos
        resolvedModules: new Map(),
        loadingPromises: new Map(),
        dependencyGraph: new Map(),
        
        // Estratégias de merge mantidas
        mergeStrategies: {
            'observable': (base, mixin) => mixin,
            'observableArray': (base, mixin) => mixin,
            'function': (base, mixin) => mixin,
            'object': (base, mixin) => ({ ...base, ...mixin }),
            'default': (base, mixin) => mixin
        },
        
        async resolveModule(modulePath, parentPath = null) {
            if(window['logger']) logger.log(`Resolving: ${modulePath}`, 'info');
            
            // Verificar cache
            if (this.resolvedModules.has(modulePath)) {
                if(window['logger']) logger.log(`${modulePath} loaded from cache`, 'info');
                return this.resolvedModules.get(modulePath);
            }
            
            // Verificar se já está sendo carregado
            if (this.loadingPromises.has(modulePath)) {
                if(window['logger']) logger.log(`${modulePath} already loading - waiting...`, 'info');
                return await this.loadingPromises.get(modulePath);
            }
            
            // Criar promise de resolução
            const resolutionPromise = this._resolveModuleInternal(modulePath, parentPath);
            this.loadingPromises.set(modulePath, resolutionPromise);
            
            try {
                const resolvedModule = await resolutionPromise;
                this.resolvedModules.set(modulePath, resolvedModule);
                return resolvedModule;
            } catch (error) {
                // Remover do cache em caso de erro
                this.resolvedModules.delete(modulePath);
                throw error;
            } finally {
                this.loadingPromises.delete(modulePath);
            }
        },
        
        async _resolveModuleInternal(modulePath, parentPath) {
            const startTime = performance.now();
            
            try {
                // 1. Carregar o módulo principal
                const moduleFactory = await this._loadModuleFactory(modulePath);
                
                // 2. Extrair informações de dependências
                const moduleInfo = this._parseModuleDefinition(moduleFactory);
                
                // 3. Resolver dependências recursivamente (SEQUENCIAL)
                const resolvedDependencies = await this._resolveDependenciesSequentially(
                    moduleInfo.dependencies, 
                    modulePath
                );
                
                // 4. Criar ctor base mergeado com dependências
                const baseCtor = this._createMergedCtor(resolvedDependencies);
                
                // 5. Executar factory do módulo para obter instância
                const moduleInstance = moduleInfo.factory();
                
                // 6. Mergear módulo na baseCtor (módulo tem prioridade)
                const finalCtor = this._applyFinalMerge(baseCtor, moduleInstance);
                
                // 7. Bind métodos
                // this._bindCtorMethods(finalCtor);
                
                // 8. Executar lifecycle hooks
                await this._executeLifecycleHooks(finalCtor, modulePath, moduleInfo.dependencies);
                
                // 9. Registrar no global.modules se necessário
                const isAlreadyLoadedModule = global.modules.find(x => x.name === finalCtor.name);
                if(!isAlreadyLoadedModule) {
                    global.modules.push({
                        name: finalCtor.name || modulePath,
                        path: modulePath,
                        dependencies: moduleInfo.dependencies,
                        ctor: finalCtor,
                        started: true,
                        createdAt: new Date()
                    });
                }

                return finalCtor;
                
            } catch (error) {
                if(window['logger']) logger.log(`Failed to resolve ${modulePath}:`, error, 'error');
                throw error;
            }
        },
        
        async _resolveDependenciesSequentially(dependencies, parentPath) {
            if (!dependencies || dependencies.length === 0) {
                return [];
            }
            
            // Detectar dependências circulares
            this._checkCircularDependencies(dependencies, parentPath);
            
            const resolvedDeps = [];
            
            for (let i = 0; i < dependencies.length; i++) {
                const dep = dependencies[i];
                
                try {
                    const resolvedDep = await this.resolveModule(dep, parentPath);
                    resolvedDeps.push(resolvedDep);
                } catch (error) {
                    if(window['logger']) logger.log(`  [${i+1}/${dependencies.length}] Failed dependency ${dep}:`, error, 'error');
                }
            }
            
            return resolvedDeps;
        },
        
        async _loadModuleFactory(modulePath) {
            return new Promise((resolve, reject) => {
                // Interceptar define global temporariamente
                const originalDefine = window.define;
                let moduleResolved = false;
                
                // Timeout para evitar travamento
                const timeout = setTimeout(() => {
                    if (!moduleResolved) {
                        window.define = originalDefine;
                        reject(new Error(`Timeout loading module: ${modulePath}`));
                    }
                }, 10000); // 10 segundos timeout
                
                window.define = (path, dependencies, factory) => {
                    if (path === modulePath && !moduleResolved) {
                        moduleResolved = true;
                        clearTimeout(timeout);
                        window.define = originalDefine; // Restaurar imediatamente
                        resolve({ path, dependencies, factory });
                    }
                };
                
                // Carregar script
                const script = document.createElement('script');
                script.src = modulePath;
                script.async = true;
                
                script.onload = () => {
                    // Dar um tempo para o define ser chamado
                    setTimeout(() => {
                        if (!moduleResolved) {
                            clearTimeout(timeout);
                            window.define = originalDefine;
                            // Módulo sem dependências
                            resolve({ 
                                path: modulePath, 
                                dependencies: [], 
                                factory: () => ({
                                    name: modulePath.split('/').pop().replace('.js', ''),
                                    kind: 'simple-module'
                                })
                            });
                        }
                    }, 100);
                };
                
                script.onerror = () => {
                    clearTimeout(timeout);
                    window.define = originalDefine;
                    reject(new Error(`Failed to load script: ${modulePath}`));
                };
                
                document.head.appendChild(script);
            });
        },
        
        _parseModuleDefinition(moduleInfo) {
            const { path, dependencies = [], factory } = moduleInfo;
            
            // Normalizar dependências para paths completos
            const normalizedDeps = dependencies.map(dep => {
                if (dep.startsWith('/static/')) return dep;
                if (dep.startsWith('mixins/')) return `/static/js/${dep}`;
                if (dep.startsWith('modules/')) return `/static/js/${dep}`;
                if (!dep.includes('/')) return `/static/js/modules/${dep}.js`;
                return dep;
            });
            
            return {
                path,
                dependencies: normalizedDeps,
                factory: factory 
            };
        },
        
        _checkCircularDependencies(dependencies, currentPath) {
            if (!this.dependencyGraph.has(currentPath)) {
                this.dependencyGraph.set(currentPath, new Set());
            }
            
            dependencies.forEach(dep => {
                this.dependencyGraph.get(currentPath).add(dep);
                
                if (this._hasCircularDependency(dep, currentPath, new Set())) {
                    throw new Error(`Circular dependency detected: ${currentPath} <-> ${dep}`);
                }
            });
        },
        
        _hasCircularDependency(from, to, visited) {
            if (visited.has(from)) return false;
            visited.add(from);
            
            const deps = this.dependencyGraph.get(from);
            if (!deps) return false;
            
            if (deps.has(to)) return true;
            
            for (const dep of deps) {
                if (this._hasCircularDependency(dep, to, visited)) {
                    return true;
                }
            }
            
            return false;
        },
        
        _createMergedCtor(dependencies) {
            let mergedCtor = {};
            
            // Merge todas as dependências em ordem
            dependencies.forEach((dependency, index) => {
                if (dependency && typeof dependency === 'object') {
                    mergedCtor = this._deepMerge(mergedCtor, dependency);
                }
            });
            
            return mergedCtor;
        },
        
        _applyFinalMerge(baseCtor, moduleInstance) {
            // O módulo atual tem prioridade sobre as dependências
            const finalCtor = this._deepMerge(baseCtor, moduleInstance);
            
            return finalCtor;
        },
        
        _deepMerge(target, source) {
            const result = { ...target };
            
            if (!source || typeof source !== 'object') {
                return result;
            }
            
            for (const [key, value] of Object.entries(source)) {
                if (this._shouldSkipMerge(key)) {
                    continue;
                }
                
                const existingValue = result[key];
                const mergeStrategy = this._getMergeStrategy(key, existingValue, value);
                
                result[key] = mergeStrategy(existingValue, value);
            }
            
            return result;
        },
        
        _shouldSkipMerge(key) {
            // Propriedades que não devem ser mergeadas
            const skipKeys = [
                'constructor', 
                'prototype', 
                '__proto__',
                'length' // Para funções
            ];
            return skipKeys.includes(key);
        },

        _getFunctionLocation(fn) {
            try { fn(); }
            catch (e) {
                const stack = e.stack.split('\n');
                for (const line of stack) {
                    if (line.includes(fn.name)) return line.trim();
                }
            }
            return null;
        },
        
        _getMergeStrategy(key, existingValue, newValue) {
            // Detectar observables do bindings
            if (typeof newValue === 'function') {
                // Verificar se é observableArray 
                if (newValue.toString().includes('observableArray') || 
                    (newValue.push && typeof newValue.push === 'function' && newValue.name.includes('obs'))) {
                    return this.mergeStrategies.observableArray;
                }

                // Verificar se é observable
                if (newValue.name && newValue.name.includes('observable') && newValue.name.includes('obs')) {
                    return this.mergeStrategies.observable;
                }
                
                return this.mergeStrategies.function;
            }
            
            if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue) && !newValue.set) {
                return this.mergeStrategies.object;
            }
            
            return this.mergeStrategies.default;
        },
        
        // _bindCtorMethods(ctor) {
        //     // Bind todas as funções para usar ctor como contexto
        //     Object.keys(ctor).forEach(key => {
        //         if (typeof ctor[key] === 'function') {
        //             // Preservar função original mas fazer bind
        //             const originalFunction = ctor[key];
                    
        //             // Verificar se não é observable ou constructor
        //             if (!originalFunction.name.includes('observable') && 
        //                 !originalFunction.name.includes('obs') &&
        //                 key !== 'constructor' &&
        //                 !key.startsWith('_')) {
                        
        //                 ctor[key] = async function(...args) {
        //                     return await originalFunction.apply(ctor, args);
        //                 };
        //             }
        //         }
        //     });
        // },
        
        async _executeLifecycleHooks(ctor, modulePath, dependencies) {
            try {
                const previousCtor = window.ctor;
                window.ctor = ctor;

                // Hook personalizado: afterDependenciesResolved
                if (typeof ctor.afterDependenciesResolved === 'function') {
                    await ctor.afterDependenciesResolved(dependencies);
                }
                
                // Hook: checkParams (existente)
                if (typeof ctor.checkParams === 'function') {
                    await ctor.checkParams(ctor.name, modulePath, dependencies);
                }
                
                // Hook: checkParamsThen (existente)
                if (typeof ctor.checkParamsThen === 'function') {
                    await ctor.checkParamsThen(ctor.name, modulePath, dependencies);
                }
                
                // Hook: init (existente)
                if (typeof ctor.init === 'function') {
                    await ctor.init(ctor.name, modulePath, dependencies);
                }
                
                // Hook: compositionComplete (existente)
                if (typeof ctor.compositionComplete === 'function') {
                    await ctor.compositionComplete(ctor.name, modulePath, dependencies);
                }
                
                // Reload bindings após lifecycle completo
                if (window.bindings && typeof bindings.reload === 'function') {
                    bindings.reload();
                }
                
            } catch (error) {
                if(window['logger']) logger.log(`Error in lifecycle hooks for ${modulePath}:`, error, 'error');
            }
        },
        
        // API pública
        async require(modulePath) {
            return await this.resolveModule(modulePath);
        },
        
        isResolved(modulePath) {
            return this.resolvedModules.has(modulePath);
        },
        
        getResolved(modulePath) {
            return this.resolvedModules.get(modulePath);
        },
        
        getCurrentCtor() {
            return window.ctor;
        },
        
        clearCache() {
            this.resolvedModules.clear();
            this.loadingPromises.clear();
            this.dependencyGraph.clear();
        },
        
        // Debug utilities
        getDependencyGraph() {
            const graph = {};
            for (const [module, deps] of this.dependencyGraph.entries()) {
                graph[module] = Array.from(deps);
            }
            return graph;
        },
        
        getLoadedModules() {
            return Array.from(this.resolvedModules.keys());
        },
        
        debugCtor() {
            console.group('Current Constructor Debug');
            if(window['logger']) logger.log('ctor keys:', Object.keys(window.ctor || {}));
            if(window['logger']) logger.log('ctor methods:', Object.keys(window.ctor || {}).filter(k => 
                typeof window.ctor[k] === 'function'
            ));
            if(window['logger']) logger.log('ctor observables:', Object.keys(window.ctor || {}).filter(k => 
                typeof window.ctor[k] === 'function' && 
                window.ctor[k].name && 
                window.ctor[k].name.includes('observable') &&
                window.ctor[k].name.includes('obs')
            ));
            console.groupEnd();
        }
    };
}

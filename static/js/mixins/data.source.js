define(`/static/js/mixins/data.source.js`, [], 
    function DataSource() {
        class APIError extends Error {
            constructor(message, details = {}) {
                super(message);
                this.name = 'APIError';
                this.details = details;
            }

            get isNetworkError() {
                return this.details.status === undefined;
            }

            get isServerError() {
                return this.details.status >= 500;
            }

            get isClientError() {
                return this.details.status >= 400 && this.details.status < 500;
            }

            get isUnauthorized() {
                return this.details.status === 401;
            }

            get isForbidden() {
                return this.details.status === 403;
            }

            get isNotFound() {
                return this.details.status === 404;
            }
        }

        window.APIError = APIError;

        return {
            name: `DataSource`,
            kind: bindings.observable(`mixin`),
            defaultDataSourceOptions: {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': () => global.config.csrfToken
                },
                timeout: 30000,
                retries: 3,
                retryDelay: 1000,
                cache: true,
                cacheTimeout: 300000, // 5 minutos
            },

            // Cache interno
            _cacheDataSource: new Map(),
            _loadingDataSourceStates: new Map(),

            async requestDataSource(endpoint, options = {}) {
                const config = ctor._buildDataSourceConfig(endpoint, options);
                const cacheKey = ctor._getDataSourceCacheKey(config);

                // Verificar cache se habilitado
                if (config.cache && ctor._cacheDataSource.has(cacheKey)) {
                    const cached = ctor._cacheDataSource.get(cacheKey);
                    if (Date.now() - cached.timestamp < config.cacheTimeout) {
                        return cached.data;
                    }
                }

                if (ctor._loadingDataSourceStates.has(cacheKey)) {
                    return ctor._loadingDataSourceStates.get(cacheKey);
                }

                const requestDataSourcePromise = ctor._executeDataSource(config);
                ctor._loadingDataSourceStates.set(cacheKey, requestDataSourcePromise);

                try {
                    const result = await requestDataSourcePromise;
                    
                    if (config.cache) {
                        ctor._cacheDataSource.set(cacheKey, {
                            data: result,
                            timestamp: Date.now()
                        });
                    }

                    ctor._loadingDataSourceStates.delete(cacheKey);
                    return result;
                } catch (error) {
                    ctor._loadingDataSourceStates.delete(cacheKey);
                    throw error;
                }
            },

            async _callServer(type, endpoint, params = {}, options = {}) {
                if(!type || !ctor.methodsDataSource.hasOwnProperty(type.toLowerCase())) return;
                return await ctor.methodsDataSource[type.toLowerCase()](endpoint, params = {}, options = {});
            },

            methodsDataSource: {
                async get(endpoint, params = {}, options = {}) {
                    return ctor.requestDataSource(endpoint, {
                        ...options,
                        method: 'GET',
                        params
                    });
                },

                async post(endpoint, data = {}, options = {}) {
                    return ctor.requestDataSource(endpoint, {
                        ...options,
                        method: 'POST',
                        data
                    });
                },

                async patch(endpoint, data = {}, options = {}) {
                    return ctor.requestDataSource(endpoint, {
                        ...options,
                        method: 'PATCH',
                        data
                    });
                },

                async put(endpoint, data = {}, options = {}) {
                    return ctor.requestDataSource(endpoint, {
                        ...options,
                        method: 'PUT',
                        data
                    });
                },

                async delete(endpoint, options = {}) {
                    return ctor.requestDataSource(endpoint, {
                        ...options,
                        method: 'DELETE'
                    });
                },
            },

            // Métodos internos
            _buildDataSourceConfig(endpoint, options) {
                const config = {
                    ...ctor.defaultDataSourceOptions,
                    ...options
                };

                config.url = ctor._buildRequestDataSourceUrl(endpoint, config.params);

                if (typeof config.headers['X-CSRFToken'] === 'function') {
                    config.headers['X-CSRFToken'] = config.headers['X-CSRFToken']();
                }

                return config;
            },

            _buildRequestDataSourceUrl(endpoint, params = {}) {
                let url = endpoint.startsWith('http') 
                    ? endpoint 
                    : `${global.config.apiUrl}${endpoint}`;

                if (params && Object.keys(params).length > 0) {
                    const searchParams = new URLSearchParams();
                    Object.entries(params).forEach(([key, value]) => {
                        if (value !== null && value !== undefined) {
                            if (Array.isArray(value)) {
                                value.forEach(v => searchParams.append(key, v));
                            } else {
                                searchParams.append(key, value);
                            }
                        }
                    });
                    
                    const paramString = searchParams.toString();
                    if (paramString) {
                        url += (url.includes('?') ? '&' : '?') + paramString;
                    }
                }

                return url;
            },

            _getDataSourceCacheKey(config) {
                return `${config.method}:${config.url}:${JSON.stringify(config.data || {})}`;
            },

            async _executeDataSource(config) {
                let lastError;

                for (let attempt = 0; attempt <= config.retries; attempt++) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

                        const fetchOptions = {
                            method: config.method,
                            headers: config.headers,
                            signal: controller.signal
                        };

                        if (config.method !== 'GET' && config.data) {
                            if (config.data instanceof FormData) {
                                fetchOptions.body = config.data;
                            } else {
                                fetchOptions.body = JSON.stringify(config.data);
                            }
                        }

                        const response = await fetch(config.url, fetchOptions);
                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            throw new APIError(`HTTP ${response.status}: ${response.statusText}`, {
                                status: response.status,
                                statusText: response.statusText,
                                url: config.url,
                                method: config.method
                            });
                        }

                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            return await response.json();
                        } else if (response.status === 204) {
                            return null; // No Content
                        } else {
                            return await response.text();
                        }

                    } catch (error) {
                        lastError = error;
                        
                        // Se não é erro de rede/timeout, não retry
                        if (error.name !== 'AbortError' && error.name !== 'TypeError') {
                            break;
                        }

                        // Se é a última tentativa, não esperar
                        if (attempt < config.retries) {
                            await ctor._delayDataSource(config.retryDelay * Math.pow(2, attempt)); // Backoff exponencial
                        }
                    }
                }

                throw lastError;
            },

            _delayDataSource(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            },

            // Métodos de cache
            clearDataSourceCache(pattern = null) {
                if (pattern) {
                    const regex = new RegExp(pattern);
                    for (const key of ctor._cacheDataSource.keys()) {
                        if (regex.test(key)) {
                            ctor._cacheDataSource.delete(key);
                        }
                    }
                } else {
                    ctor._cacheDataSource.clear();
                }
            },

            getDataSourceCacheSize() {
                return ctor._cacheDataSource.size;
            },

            // Estado de loading
            isDataSourceLoading(endpoint, options = {}) {
                const config = ctor._buildDataSourceConfig(endpoint, options);
                const cacheKey = ctor._getDataSourceCacheKey(config);
                return ctor._loadingDataSourceStates.has(cacheKey);
            },

            // Cancelar requisições
            cancelAllDataSources() {
                ctor._loadingDataSourceStates.clear();
            }
        }     
    }
);

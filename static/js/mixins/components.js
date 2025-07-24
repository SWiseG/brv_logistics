define(`/static/js/mixins/components.js`, [], 
    function Components() {
        return {
            name: `Components`,
            kind: bindings.observable(`mixin`),

            fieldCounter: bindings.observable(0),
            defaultConfig: {
                theme: 'bootstrap5',
                animate: true,
                validateOnBlur: true,
                showErrors: true,
                useJqueryValidator: true,
                useBindings: true,
                errorPosition: 'bottom',
            },
            
            fieldTypes: new Map(),
            validators: new Map(),
            fieldInstances: new Map(),
            
            fieldStates: bindings.observable({}),
            formErrors: bindings.observable({}),
            formData: bindings.observable({}),

            validatorDefaults: {
                errorClass: 'is-invalid',
                validClass: 'is-valid',
                errorPlacement: (error, element) => {
                    const container = element.closest('[data-field-container]');
                    const errorElement = container.find('.invalid-feedback');
                    errorElement.html(error.text()).show();
                },
                success: (label, element) => {
                    const container = $(element).closest('[data-field-container]');
                    const errorElement = container.find('.invalid-feedback');
                    const successElement = container.find('.valid-feedback');
                    
                    errorElement.hide();
                    successElement.show();
                },
                highlight: (element) => {
                    $(element).addClass('is-invalid').removeClass('is-valid');
                },
                unhighlight: (element) => {
                    $(element).addClass('is-valid').removeClass('is-invalid');
                }
            },
        
            compositionComplete: (name, path, dependencies, callback, params) => {
                ctor.setupJqueryValidator();
                ctor.registerFieldsTypes();
            },
            
            // ================================
            // JQUERY VALIDATOR SETUP
            // ================================
            setupJqueryValidator() {
                if (typeof $ !== 'undefined' && $.validator) {
                    // Configurações globais do jQuery Validator
                    $.validator.setDefaults(ctor.validatorDefaults);
                    
                    // Métodos customizados de validação
                    ctor.addCustomValidationMethods();
                }
            },
            
            addCustomValidationMethods() {
                // CPF Validator
                $.validator.addMethod("cpf", function(value, element) {
                    if (!value) return true; // Opcional se não obrigatório
                    
                    value = value.replace(/[^\d]/g, '');
                    if (value.length !== 11) return false;
                    
                    // Verificar se todos os dígitos são iguais
                    if (/^(\d)\1+$/.test(value)) return false;
                    
                    // Validar dígitos verificadores
                    let sum = 0;
                    for (let i = 0; i < 9; i++) {
                        sum += parseInt(value.charAt(i)) * (10 - i);
                    }
                    let remainder = 11 - (sum % 11);
                    if (remainder === 10 || remainder === 11) remainder = 0;
                    if (remainder !== parseInt(value.charAt(9))) return false;
                    
                    sum = 0;
                    for (let i = 0; i < 10; i++) {
                        sum += parseInt(value.charAt(i)) * (11 - i);
                    }
                    remainder = 11 - (sum % 11);
                    if (remainder === 10 || remainder === 11) remainder = 0;
                    return remainder === parseInt(value.charAt(10));
                }, "CPF inválido");
                
                // CNPJ Validator
                $.validator.addMethod("cnpj", function(value, element) {
                    if (!value) return true;
                    
                    value = value.replace(/[^\d]/g, '');
                    if (value.length !== 14) return false;
                    
                    // Verificar se todos os dígitos são iguais
                    if (/^(\d)\1+$/.test(value)) return false;
                    
                    // Validar dígitos verificadores CNPJ
                    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
                    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
                    
                    let sum = 0;
                    for (let i = 0; i < 12; i++) {
                        sum += parseInt(value.charAt(i)) * weights1[i];
                    }
                    let remainder = sum % 11;
                    const digit1 = remainder < 2 ? 0 : 11 - remainder;
                    
                    if (digit1 !== parseInt(value.charAt(12))) return false;
                    
                    sum = 0;
                    for (let i = 0; i < 13; i++) {
                        sum += parseInt(value.charAt(i)) * weights2[i];
                    }
                    remainder = sum % 11;
                    const digit2 = remainder < 2 ? 0 : 11 - remainder;
                    
                    return digit2 === parseInt(value.charAt(13));
                }, "CNPJ inválido");
                
                // CEP Validator
                $.validator.addMethod("cep", function(value, element) {
                    if (!value) return true;
                    return /^\d{5}-?\d{3}$/.test(value);
                }, "CEP inválido");
                
                // Telefone Brasileiro
                $.validator.addMethod("telefone", function(value, element) {
                    if (!value) return true;
                    const cleaned = value.replace(/\D/g, '');
                    return cleaned.length === 10 || cleaned.length === 11;
                }, "Telefone inválido");
            },

            // ================================
            // CORE METHODS - CRIAÇÃO DE CAMPOS
            // ================================
            /**
             * Cria campo com integração completa de bindings e validação
             */
            createField(config = {}) {
                // Validar e normalizar configuração
                const validatedConfig = ctor.validateConfig(config);
                
                // Gerar ID único
                if (!validatedConfig.id) {
                    validatedConfig.id = ctor.generateFieldId(validatedConfig.type);
                }
                
                // Criar observable específico do campo se bindings estiver disponível
                ctor.createFieldBindings(validatedConfig);
                
                // Criar estrutura do campo
                const fieldStructure = ctor.createFieldStructure(validatedConfig);
                const fieldElement = ctor.createElement(validatedConfig);
                const completeField = ctor.assembleField(fieldStructure, fieldElement, validatedConfig);
                
                // Aplicar configurações
                ctor.applyFieldConfig(completeField, validatedConfig);
                
                // Configurar jQuery Validator se habilitado
                if (validatedConfig.useJqueryValidator && $.validator) {
                    ctor.setupFieldValidation(completeField, validatedConfig);
                }
                
                // Configurar bindings se habilitado
                if (validatedConfig.useBindings) {
                    ctor.setupFieldBindings(completeField, validatedConfig);
                }
                
                // Registrar eventos
                ctor.attachFieldEvents(completeField, validatedConfig);
                
                // Armazenar instância
                ctor.fieldInstances.set(validatedConfig.id, {
                    config: validatedConfig,
                    element: completeField,
                    fieldElement: completeField.find(`#${validatedConfig.id}`)
                });
                
                return completeField;
            },
            
            createFieldBindings(config) {
                // Observable para valor do campo
                bindings.observables[`${config.id}_value`] = bindings.observable(config.value || '');
                
                // Observable para estado de validação
                bindings.observables[`${config.id}_valid`] = bindings.observable(true);
                
                // Observable para erros
                bindings.observables[`${config.id}_errors`] = bindings.observable([]);
                
                // Observable para estado de loading
                bindings.observables[`${config.id}_loading`] = bindings.observable(false);
            },
            
            setupFieldValidation(fieldContainer, config) {
                const fieldElement = fieldContainer.find(`#${config.id}`);
                const form = fieldElement.closest('form');
                
                // Regras de validação para jQuery Validator
                const rules = ctor.buildValidationRules(config);
                const messages = ctor.buildValidationMessages(config);
                
                // Se não há um form, criar um wrapper temporário
                if (form.length === 0) {
                    fieldElement.wrap('<form class="field-validation-form"></form>');
                }
                
                // Aplicar validação
                const validationForm = fieldElement.closest('form');
                
                if (!validationForm.data('validator')) {
                    validationForm.validate({
                        ...ctor.validatorDefaults,
                        rules: { [config.name || config.id]: rules },
                        messages: { [config.name || config.id]: messages },
                        
                        // Callbacks customizados
                        invalidHandler: (event, validator) => {
                            if (config.onInvalid) {
                                config.onInvalid(validator.errorList, fieldElement, config);
                            }
                        },
                        
                        submitHandler: (form) => {
                            if (config.onSubmit) {
                                config.onSubmit($(form).serialize(), fieldElement, config);
                            }
                        }
                    });
                } else {
                    // Adicionar regras a um validador existente
                    validationForm.rules('add', {
                        [config.name || config.id]: { ...rules, messages }
                    });
                }
            },
            
            buildValidationRules(config) {
                const rules = {};
                
                if (config.required) rules.required = true;
                if (config.validation.minLength) rules.minlength = config.validation.minLength;
                if (config.validation.maxLength) rules.maxlength = config.validation.maxLength;
                if (config.validation.min) rules.min = config.validation.min;
                if (config.validation.max) rules.max = config.validation.max;
                if (config.validation.email) rules.email = true;
                if (config.validation.url) rules.url = true;
                if (config.validation.number) rules.number = true;
                if (config.validation.digits) rules.digits = true;
                if (config.validation.cpf) rules.cpf = true;
                if (config.validation.cnpj) rules.cnpj = true;
                if (config.validation.cep) rules.cep = true;
                if (config.validation.telefone) rules.telefone = true;
                
                // Validação customizada
                if (config.validation.custom && typeof config.validation.custom === 'function') {
                    rules.custom = config.validation.custom;
                }
                
                return rules;
            },
            
            buildValidationMessages(config) {
                const messages = {};

                if (config.messages) {
                    Object.assign(messages, config.messages);
                }
                
                return messages;
            },
            
            setupFieldBindings(fieldContainer, config) {                
                const fieldElement = fieldContainer.find(`#${config.id}`);
                const valueObservable = bindings.observables[`${config.id}_value`];
                const validObservable = bindings.observables[`${config.id}_valid`];
                const errorsObservable = bindings.observables[`${config.id}_errors`];
                
                // Binding bidirecional de valor
                if (valueObservable) {
                    // Observable -> Campo
                    valueObservable.subscribe(value => {
                        if (fieldElement.val() !== value) {
                            fieldElement.val(value);
                        }
                    });
                    
                    // Campo -> Observable
                    fieldElement.on('input change', () => {
                        const currentValue = fieldElement.val();
                        if (valueObservable() !== currentValue) {
                            valueObservable(currentValue);
                            
                            // Atualizar observable global do form
                            if (bindings.observables.formData) {
                                const formData = bindings.observables.formData();
                                formData[config.name || config.id] = currentValue;
                                bindings.observables.formData(formData);
                            }
                        }
                    });
                }

                // Binding de estado de validação
                if (validObservable) {
                    validObservable.subscribe(isValid => {
                        if($('#' + fieldElement.attr('id')).length > 0) {
                            if (isValid) {
                                fieldElement.removeClass('is-invalid').addClass('is-valid');
                            } else {
                                fieldElement.removeClass('is-valid').addClass('is-invalid');
                            }
                        };
                    });
                }
                
                // Binding de erros
                if (errorsObservable) {
                    errorsObservable.subscribe(errors => {
                        const container = fieldElement.closest('[data-field-container]');
                        const errorElement = container.find('.invalid-feedback');
                        
                        if (errors.length > 0) {
                            errorElement.html(errors.join('<br>')).show();
                        } else {
                            errorElement.hide();
                        }
                    });
                }
            },


            // ================================
            // TIPOS DE CAMPO
            // ================================
            
            registerFieldsTypes() {
                // TEXTO COM BINDING
                ctor.registerFieldType('text', {
                    createElement: (config) => {
                        const input = $('<input>')
                            .attr('type', 'text')
                            .attr('id', config.id)
                            .attr('name', config.name || config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder)
                            .val(config.value);
                        
                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);

                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);
                        
                        return input;
                    }
                });
                
                // EMAIL COM VALIDAÇÃO AUTOMÁTICA
                ctor.registerFieldType('email', {
                    createElement: (config) => {
                        const input = $('<input>')
                            .attr('type', 'email')
                            .attr('id', config.id)
                            .attr('name', config.name || config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder || 'exemplo@email.com')
                            .val(config.value);
                        
                        // Habilitar validação de email por padrão
                        if (!config.validation) config.validation = {};
                        config.validation.email = true;
                        
                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);

                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);
                        
                        return input;
                    }
                });
                
                // CPF COM MÁSCARA E VALIDAÇÃO
                ctor.registerFieldType('cpf', {
                    createElement: (config) => {
                        const input = $('<input>')
                            .attr('type', 'text')
                            .attr('id', config.id)
                            .attr('name', config.name || config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder || '000.000.000-00')
                            .attr('maxlength', '14')
                            .val(config.value);
                        
                        // Configurar validação CPF
                        if (!config.validation) config.validation = {};
                        config.validation.cpf = true;

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);

                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);
                        
                        // Aplicar máscara
                        input.on('input', function() {
                            let value = $(this).val().replace(/\D/g, '');
                            value = value.replace(/(\d{3})(\d)/, '$1.$2');
                            value = value.replace(/(\d{3})(\d)/, '$1.$2');
                            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                            $(this).val(value);
                        });
                        
                        return input;
                    }
                });

                // NUMERIC
                ctor.registerFieldType('numeric', {
                    createElement: (config) => {
                        const input = $('<input type="number">')
                            .attr('id', config.id)
                            .addClass(config.inputClasses.join(' '))
                            .val(config.value || '')
                            .attr('placeholder', config.placeholder || '');
                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);
                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);
                        ctor._validationHandler(input, config);
                        return input;
                    }
                });

                // CURRENCY
                ctor.registerFieldType('currency', {
                    createElement: (config) => {
                        const input = $('<input type="text">')
                            .attr('id', config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder || '0,00')
                            .val(config.value || '');

                        input.on('input', function () {
                            let val = $(this).val().replace(/\D/g, '');
                            val = (parseInt(val || '0', 10) / 100).toFixed(2).replace('.', ',');
                            $(this).val(val);
                        });

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);
                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);
                        ctor._validationHandler(input, config);
                        return input;
                    }
                });

                // DATE
                ctor.registerFieldType('date', {
                    createElement: (config) => {
                        const input = $('<input>')
                            .attr('type', 'text')
                            .attr('id', config.id)
                            .attr('name', config.name || config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder || 'YYYY-MM-DD')
                            .val(config.value);

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);

                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);
                        
                        // jQuery UI Datepicker ou Flatpickr
                        input.datepicker({ dateFormat: 'yy-mm-dd' });

                        input.on('blur', function() {
                            $(this).val(ctor._date($(this).val(), 'date'));
                        });

                        return input;
                    }
                });

                // TIME
                ctor.registerFieldType('time', {
                    createElement: (config) => {
                        const input = $('<input type="text">')
                            .attr('id', config.id)
                            .addClass(config.inputClasses.join(' '))
                            .val(config.value || '')
                            .attr('placeholder', config.placeholder || 'HH:mm');

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);
                        
                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);

                        ctor._validationHandler(input, config);

                        if ($.fn.timepicker) input.timepicker({ timeFormat: 'HH:mm' });

                        input.on('blur', function () {
                            if($(this).val() === null || !$(this).val()) return;
                            $(this).val(ctor._date(`1970-01-01 ${$(this).val()}`, 'time'));
                        });

                        return input;
                    }
                });

                // DATETIME
                ctor.registerFieldType('datetime', {
                    createElement: (config) => {
                        const input = $('<input>')
                            .attr('type', 'text')
                            .attr('id', config.id)
                            .attr('name', config.name || config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder || 'YYYY-MM-DD HH:MM')
                            .val(config.value);

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);

                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);

                        // Flatpickr ou datetimepicker jQuery UI
                        if ($.fn.datetimepicker) {
                            input.datetimepicker({ dateFormat: 'yy-mm-dd', timeFormat: 'HH:mm' });
                        }

                        input.on('blur', function() {
                            $(this).val(ctor._date($(this).val(), 'datetime'));
                        });

                        return input;
                    }
                });

                // BETWEEN DATES
                ctor.registerFieldType('betweenDates', {
                    createElement: (config) => {
                        const container = $('<div class="d-flex gap-2"></div>');

                        const startId = `${config.id}_start`;
                        const endId = `${config.id}_end`;

                        const startInput = $('<input>')
                            .attr('type', 'text')
                            .attr('id', startId)
                            .attr('name', startId)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholderStart || 'Data Inicial')
                            .val(config.value?.start || '');

                        const endInput = $('<input>')
                            .attr('type', 'text')
                            .attr('id', endId)
                            .attr('name', endId)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholderEnd || 'Data Final')
                            .val(config.value?.end || '');

                        if (config.useBindings) {
                            bindings.observables[`${startId}_value`] = bindings.observable(config.value?.start || '');
                            bindings.observables[`${endId}_value`] = bindings.observable(config.value?.end || '');

                            startInput.attr('data-bind-value', `${startId}_value`);
                            endInput.attr('data-bind-value', `${endId}_value`);
                        }

                        startInput.datepicker({ dateFormat: 'yy-mm-dd' });
                        endInput.datepicker({ dateFormat: 'yy-mm-dd' });

                        startInput.on('blur', function() {
                            $(this).val(ctor._date($(this).val(), 'date'));
                        });

                        endInput.on('blur', function() {
                            $(this).val(ctor._date($(this).val(), 'date'));
                        });

                        container.append(startInput, endInput);
                        return container;
                    }
                });

                // DROPDOWN
                ctor.registerFieldType('dropdown', {
                    createElement: (config) => {
                        const options = config.options || [];
                        const minLength = config.minSearchLenght || 0;
                        const debounceDelay = config.debounceDelay || 300;
                        const container = $('<div class="dropdown-select position-relative"></div>');
                        const input = $('<input type="text">')
                                        .attr('id', config.id)
                                        .addClass(config.inputClasses.join(' '))
                                        .attr('placeholder', config.placeholder || '')
                                        .val(config.value || '');

                        const dropdown = $('<div class="dropdown-menu w-100 bg-white border rounded shadow" style="display:none; position:absolute; z-index:1050;"></div>');
                        const toggleBtn = $('<i class="fas fa-caret-down" style="position:absolute; right:35px; top:50%; transform:translateY(-50%); cursor:pointer;"></i>');

                        let debounceTimer = null;
                        let isDropdownOpen = false;

                        const renderItems = (items) => {
                            dropdown.empty();

                            if (!items || items.length === 0) {
                                dropdown.append('<div class="dropdown-item disabled text-muted">Nenhum resultado encontrado</div>');
                                return;
                            }

                            items.forEach(opt => {
                                const item = $('<div class="dropdown-item option">')
                                .text(opt.label || opt.value)
                                .attr('data-value', opt.value)
                                .on('mousedown', (e) => {
                                    e.preventDefault();
                                    input.val(opt.label);
                                    bindings.observables[`${config.id}_value`](opt.value);
                                    closeDropdown();
                                });

                                if(bindings.observables[`${config.id}_value`]() === opt.value) item.addClass('selected');
                                else item.removeClass('selected');

                                dropdown.append(item);
                            });
                        };

                        const filterOptions = (query) => {
                            if (!query || query.length < minLength) return options;
                            return options.filter(opt =>
                                (opt.label || '').toLowerCase().includes(query.toLowerCase())
                            );
                        };

                        const fetchAndRender = (query) => {
                            const filtered = filterOptions(query);
                            renderItems(filtered);
                            openDropdown();
                        };

                        const openDropdown = () => {
                            if (!isDropdownOpen) {
                                dropdown.stop(true, true).fadeIn(150);
                                isDropdownOpen = true;
                            }
                        };

                        const closeDropdown = () => {
                            if (isDropdownOpen) {
                                dropdown.stop(true, true).fadeOut(150);
                                isDropdownOpen = false;
                            }
                        };

                        input.on('input', () => {
                            clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(() => {
                                fetchAndRender(input.val());
                            }, debounceDelay);
                        });

                        input.on('focus', () => {
                            fetchAndRender(input.val());
                        });

                        toggleBtn.on('mousedown', (e) => {
                            e.preventDefault();
                            if (isDropdownOpen) {
                                closeDropdown();
                            } else {
                                fetchAndRender('');
                            }
                        });

                        input.on('blur', () => {
                            const typedText = input.val();
                            let matched = null;
                            dropdown.find('.dropdown-item.option').each(function () {
                                const text = $(this).text().trim();
                                const value = $(this).data('value');
                                if (text === typedText) {
                                matched = value;
                                }
                            });

                            if (matched === null) {
                                input.val('');
                                bindings.observables[`${config.id}_value`](null);
                            }

                            setTimeout(() => closeDropdown(), 200);
                        });

                        ctor._validationHandler(input, config);

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);
    
                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);

                        container.append(input, toggleBtn, dropdown);
                        return container;

                    }
                });

                // COMBOBOX
                ctor.registerFieldType('combobox', {
                    createElement: (config) => {
                        const fetchOptions = config.fetchOptions && typeof config.fetchOptions === 'function' ? config.fetchOptions : ctor._results;
                        const minLength = config.minSearchLenght || 3;
                        const endPoint = config.comboboxOptions.endPoint || '';
                        const textField = config.comboboxOptions.textField || '';
                        const valField = config.comboboxOptions.valField || 'id';
                        const debounceDelay = config.debounceDelay || 300;

                        const container = $('<div class="dropdown-combobox position-relative"></div>');
                        const input = $('<input type="text">')
                            .attr('id', config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder || '')
                            .val(config.value || '');

                        const dropdown = $('<div class="dropdown-menu w-100 bg-white border rounded shadow" style="display:none; position:absolute; z-index:1050;"></div>');

                        const toggleBtn = $('<i class="fas fa-caret-down" style="position:absolute; right:35px; top:50%; transform:translateY(-50%); cursor:pointer;"></i>');

                        let debounceTimer = null;
                        let isDropdownOpen = false; // Controle de estado

                        const renderItems = (items, loading, error) => {
                            dropdown.empty();

                            if (loading) {
                                dropdown.append('<div class="dropdown-item disabled text-muted">Carregando...</div>');
                                return;
                            }

                            if (error) {
                                dropdown.append('<div class="dropdown-item disabled text-danger">Erro ao buscar dados</div>');
                                return;
                            }

                            if (!items || items.length === 0) {
                                dropdown.append('<div class="dropdown-item disabled text-muted">Nenhum resultado encontrado</div>');
                                return;
                            }

                            items.forEach(opt => {
                                const item = $('<div class="dropdown-item option">')
                                    .text(opt.label || opt.value)
                                    .on('mousedown', (e) => {
                                        e.preventDefault();
                                        input.val(opt.label || opt.value).trigger('input').trigger('change');
                                        bindings.observables[`${config.id}_value`](opt.value);
                                        input.val(opt.label);
                                        input.text(opt.label);
                                        closeDropdown();
                                    });
                                
                                if(bindings.observables[`${config.id}_value`]() === opt.value) item.addClass('selected');
                                else item.removeClass('selected');

                                dropdown.append(item);
                            });
                        };

                        const fetchAndRender = (query) => {
                            if (query.length < minLength && query !== '') {
                                closeDropdown();
                                return;
                            }

                            bindings.observables[`${config.id}_loading`](true);
                            renderItems([], true, false);

                            fetchOptions(query, dropdown, input, textField, valField, endPoint)
                                .then(items => renderItems(items, false, false))
                                .catch(() => renderItems([], false, true))
                                .finally(() => bindings.observables[`${config.id}_loading`](false));

                            openDropdown();
                        };

                        const openDropdown = () => {
                            if (!isDropdownOpen) {
                                dropdown.stop(true, true).fadeIn(150);
                                isDropdownOpen = true;
                            }
                        };

                        const closeDropdown = () => {
                            if (isDropdownOpen) {
                                dropdown.stop(true, true).fadeOut(150);
                                isDropdownOpen = false;
                            }
                        };

                        input.on('input', () => {
                            clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(() => fetchAndRender(input.val()), debounceDelay);
                        });

                        input.on('focus', () => {
                            if (input.val().length >= minLength) {
                                fetchAndRender(input.val());
                            }
                        });

                        toggleBtn.on('mousedown', (e) => {
                            e.preventDefault();
                            if (isDropdownOpen) {
                                closeDropdown();
                            } else {
                                // Clique na seta = busca sem filtro
                                fetchAndRender('');
                            }
                        });

                        input.on('blur', () => {
                            const typedText = input.val();
                            let matchedOption = null;
                            // Verifica se o texto digitado corresponde exatamente a algum label visível
                            dropdown.find('.dropdown-item.option').each(function () {
                                const text = $(this).text().trim();
                                const value = $(this).data('value');
                                if (text === typedText) {
                                    matchedOption = value;
                                };
                            });
                            if (matchedOption === null) {
                                input.val('');
                                input.text('');
                                bindings.observables[`${config.id}_value`](null);
                            };
                            setTimeout(() => closeDropdown(), 200);
                        });

                        ctor._validationHandler(input, config);

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);

                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config, input, dropdown, fetchOptions);

                        container.append(input, toggleBtn, dropdown);
                        return container;
                    }
                });

                // MULTI-SELECT (DEV)
                ctor.registerFieldType('multi-select', {
                    createElement: (config) => {
                        const fetchTree = typeof config.fetchTree === 'function' ? config.fetchTree : ctor._multiSelectResults;
                        const childrenField = config.childrenField || 'children';
                        const multiple = !!config.multiple;
                        const endPoint = config.comboboxOptions.endPoint || '';
                        const textField = config.comboboxOptions.textField || 'label';
                        const valField = config.comboboxOptions.valField || 'value';
                        const parentTag = config.comboboxOptions.parentTag || null;

                        const container = $('<div class="tree-select-wrapper position-relative"></div>');
                        const dropdown = $('<div class="dropdown-multi-select dropdown-menu w-100 bg-white border rounded shadow" style="display:none; position:absolute; z-index:1050;"></div>');
                        const toggleBtn = $('<i class="fas fa-caret-down" style="position:absolute; right:35px; top:50%; transform:translateY(-50%); cursor:pointer;"></i>');
                        const input = $('<input type="text" readonly>')
                            .attr('id', config.id)
                            .addClass(config.inputClasses.join(' '))
                            .attr('placeholder', config.placeholder || '');
                        const chips = $('<div class="tree-chip-container d-flex flex-wrap gap-1 mb-1"></div>');

                        let isDropdownOpen = false;
                        let selected = [];

                        const openDropdown = () => {
                            dropdown.stop(true, true).fadeIn(150);
                            isDropdownOpen = true;
                        };

                        const closeDropdown = () => {
                            dropdown.stop(true, true).fadeOut(150);
                            isDropdownOpen = false;
                        };

                        const renderChips = () => {
                            chips.empty();
                            selected.forEach((item, idx) => {
                                const chip = $(`
                                    <span class="badge badge-light border px-2 py-1 d-inline-flex align-items-center">
                                        ${item.label}
                                        <i class="fas fa-times ml-2 text-muted small" style="margin-left: 6px; cursor: pointer;"></i>
                                    </span>`);
                                chip.find('i').on('click', () => {
                                    selected.splice(idx, 1);
                                    bindings.observables[`${config.id}_value`](selected.map(i => i.value));
                                    renderChips();
                                });
                                chips.append(chip);
                            });
                            input.val(selected.map(i => i.label).join(', '));
                        };

                        const renderNode = (node, level = 0) => {
                            const hasChildren = node[childrenField] && node[childrenField].length > 0;
                            const itemWrapper = $('<div class="tree-node-wrapper"></div>');

                            const item = $(`
                                <div class="dropdown-item tree-item d-flex align-items-center" style="padding-left:${level * 1.25 + 0.5}rem">
                                </div>`);
                            const label = $('<span>')
                                .text(node.label)
                                .css('flex-grow', '1');

                            if (selected.find(sel => sel.value === node.value)) item.addClass('selected');
                            else item.removeClass('selected');

                            const clickHandler = (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!multiple) {
                                    selected = [node];
                                    bindings.observables[`${config.id}_value`](node.value);
                                } else {
                                    if (!selected.find(i => i.value === node.value)) {
                                        selected.push(node);
                                        bindings.observables[`${config.id}_value`](selected.map(i => i.value));
                                        $(e.currentTarget).toggleClass('selected');
                                    }
                                }
                                renderChips();
                                if (!multiple) closeDropdown();
                            };

                            item.on('mousedown', clickHandler);
                            item.append(label);

                            if (hasChildren) {
                                const toggle = $('<i class="fas fa-caret-right mr-2 toggle-tree" style="cursor:pointer;width: 26px;text-align: center;margin-right: 5px;height: 100%;z-index:1001"></i>');
                                item.prepend(toggle);

                                const childrenContainer = $('<div class="tree-children" style="display:none;"></div>');

                                toggle.on('click', (e) => {
                                    e.stopPropagation();
                                    const expanded = childrenContainer.is(':visible');
                                    toggle
                                        .toggleClass('fa-caret-down', !expanded)
                                        .toggleClass('fa-caret-right', expanded);
                                    childrenContainer.slideToggle(150);
                                });

                                itemWrapper.append(item, childrenContainer);

                                node[childrenField].forEach(child => {
                                    const childNode = renderNode(child, level + 1);
                                    childrenContainer.append(childNode);
                                });
                            } else {
                                itemWrapper.append(item);
                            }

                            return itemWrapper;
                        };

                        const fetchAndRenderTree = () => {
                            dropdown.empty().append('<div class="dropdown-item disabled text-muted"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando...</div>');
                            fetchTree(endPoint, textField, valField, parentTag)
                                .then(tree => {
                                    dropdown.empty();
                                    tree.forEach(node => {
                                        const nodeElem = renderNode(node, 0);
                                        dropdown.append(nodeElem);
                                    });
                                    openDropdown();
                                })
                                .catch(() => {
                                    dropdown.empty().append('<div class="dropdown-item disabled text-danger">Erro ao carregar árvore</div>');
                                });
                        };

                        toggleBtn.on('mousedown', (e) => {
                            e.preventDefault();
                            if (isDropdownOpen) {
                                closeDropdown();
                            } else {
                                fetchAndRenderTree();
                            }
                        });

                        input.on('focus', () => {
                            fetchAndRenderTree();
                        });

                        input.on('blur', () => {
                            setTimeout(() => closeDropdown(), 200);
                        });

                        ctor._validationHandler(input, config);

                        // Adicionar atributos de binding se habilitado
                        ctor.applyBindings(input, config);
                        
                        // Adicionar atributos de dependencia entre campos
                        ctor.applyCascadeFromOptions(config);

                        container.append(chips, input, toggleBtn, dropdown);
                        return container;
                    }
                });
            },

            // ================================
            // SISTEMA DE VALIDAÇÃO
            // ================================
            
            
            // ================================
            // SISTEMA DE FORMATAÇÃO
            // ================================
            
            
            // ================================
            // UTILIDADES
            // ================================
            _multiSelectResults: (endPoint, textField, valField, parentTag=null) => {
                return new Promise((resolve, reject) => {
                    $.getJSON(`${global.config.apiUrl}${endPoint}/?format=json`)
                        .then(response => {
                            var results = response.results || [];
                            if(results.length > 0) results = results.filter(x => x[parentTag || 'parent'] === null);
                            return resolve( 
                                results.map(results => ({
                                    label: results[textField],
                                    value: results[valField || 'id'],
                                    children: results.children.length > 0 ? results.children.map(child => ({ label: child[textField], value: child[valField] })) : []
                                }))
                            );
                        })
                        .catch(error => {
                            console.error('Error trying to get the API results:', error);
                            return reject(error);
                        });
                });
            },

            _results: (query, dropdown, input, textField, valField, endPoint) => {
                return new Promise((resolve, reject) => {
                    const baseUrl = `${global.config.apiUrl}${endPoint}/?format=json`;
                    const url = query && query.length > 0
                        ? `${baseUrl}&search=${encodeURIComponent(query)}`
                        : baseUrl;

                    $.getJSON(url)
                        .then(response => {
                            const results = response.results || [];
                            return resolve(
                                results.map(results => ({
                                    label: results[textField],
                                    value: results[valField || 'id']
                                }))
                            );
                        })
                        .catch(error => {
                            console.error('Error trying to get the API results:', error);
                            return reject(error);
                        });
                });
            },

            pad: (n) => (n < 10 ? '0' + n : n),
            
            animateComboDropdown: (container, show = true) => {
                container.stop(true, true);
                if (show) {
                    container.css({ opacity: 0, display: 'block' }).animate({ opacity: 1 }, 150);
                } else {
                    container.animate({ opacity: 0 }, 150, () => container.hide());
                }
            },
            
            addToggleButton: (input, dropdown) => {
                    const toggle = $('<i class="fa fa-caret-down"></i>')
                        .css({ position: 'absolute', right: 25, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' })
                        .on('click', () => ctor.animateComboDropdown(dropdown, dropdown.is(':hidden')));

                    const wrapper = $('<div class="position-relative w-100"></div>');
                    wrapper.append(input).append(toggle).append(dropdown);
                    return wrapper;
            },

            _validationHandler: (input, config) => {
                input.on('blur change input', function () {
                    const val = $(this).val();
                    if (!val && !config.keepValidationOnEmpty) {
                        $(this).removeClass('is-valid is-invalid');
                        $(this).closest('.editor-form-field').find('.invalid-feedback, .valid-feedback').hide();
                    }
                });
            },

            _dropdownOptions: (input, dropdown, options, config) => {
                const noResultMsg = $('<div class="dropdown-item disabled text-muted">Nenhum dado encontrado</div>').hide();
                dropdown.append(noResultMsg);

                const renderOptions = (filter = '') => {
                    dropdown.children('.dropdown-item.option').remove();
                    const filtered = options.filter(opt => {
                    const label = (opt.label || opt.value || '').toLowerCase();
                        return label.includes(filter.toLowerCase());
                    });

                    if (filtered.length === 0) {
                        noResultMsg.show();
                    } else {
                        noResultMsg.hide();
                        filtered.forEach(opt => {
                            const item = $('<div class="dropdown-item option">')
                            .text(opt.label || opt.value)
                            .on('mousedown', (e) => {
                                e.preventDefault(); 
                                input.val(opt.label || opt.value).trigger('input').trigger('change');
                                dropdown.find('.dropdown-item').removeClass('selected');
                                item.addClass('selected');
                                ctor.animateComboDropdown(dropdown, false);
                            });

                            if ((opt.label || opt.value) === input.val()) {
                                item.addClass('selected');
                            }

                            dropdown.append(item);
                        });
                    }
                };

                input.on('input', () => {
                    if (input.val().length >= 3) {
                        renderOptions(input.val());
                        ctor.animateComboDropdown(dropdown, true);
                    } else {
                        ctor.animateComboDropdown(dropdown, false);
                    }
                });

                input.on('focus', () => {
                    if (input.val().length >= 3) {
                        renderOptions(input.val());
                        ctor.animateComboDropdown(dropdown, true);
                    }
                });

                input.on('blur', () => {
                    setTimeout(() => ctor.animateComboDropdown(dropdown, false), 200);
                });

                return { renderOptions };
            },
            /**
             * Formata os campos básicos de data
             */
            _date: (val, mode) => {
                if (!val) return '';
                const date = new Date(val);
                if (isNaN(date)) return val;

                if (mode === 'date') return `${date.getFullYear()}-${ctor.pad(date.getMonth() + 1)}-${ctor.pad(date.getDate())}`;
                if (mode === 'time') return `${ctor.pad(date.getHours())}:${ctor.pad(date.getMinutes())}`;
                if (mode === 'datetime') return `${ctor._date(val, 'date')} ${ctor._date(val, 'time')}`;
                if (mode === 'datetimeoffset') {
                    const offset = -date.getTimezoneOffset();
                    const sign = offset >= 0 ? '+' : '-';
                    const h = ctor.pad(Math.floor(Math.abs(offset) / 60));
                    const m = ctor.pad(Math.abs(offset) % 60);
                    return `${ctor._date(val, 'datetime')} ${sign}${h}:${m}`;
                }
                return val;
            },
            /**
             * Obtém valor do campo usando bindings se disponível
             */
            _value(fieldId) {
                if (bindings.observables[`${fieldId}_value`]) {
                    return bindings.observables[`${fieldId}_value`]();
                }
                
                const fieldElement = $(`#${fieldId}`);
                return fieldElement.val();
            },
            
            /**
             * Define valor do campo usando bindings se disponível
             */
            _setValue(fieldId, value) {
                if (bindings.observables[`${fieldId}_value`]) {
                    bindings.observables[`${fieldId}_value`](value);
                } else {
                    const fieldElement = $(`#${fieldId}`);
                    fieldElement.val(value).trigger('change');
                }
            },

            /**
             * Valida um campo específico
             */
            validateField(fieldId) {
                const instance = ctor.fieldInstances.get(fieldId);
                if (!instance) return false;
                
                const fieldElement = instance.fieldElement;
                const form = fieldElement.closest('form');
                
                if (form.length && form.data('validator')) {
                    const isValid = fieldElement.valid();
                    
                    if(bindings.observables[`${fieldId}_value`]() !== '' && bindings.observables[`${fieldId}_value`]() !== null) {
                        // Atualizar observable de validação
                        if (bindings.observables[`${fieldId}_valid`]) {
                            bindings.observables[`${fieldId}_valid`](isValid);
                        };
                    }
                    else {
                        fieldElement.removeClass('is-valid is-invalid');
                        fieldElement.closest('.editor-form-field').find('.invalid-feedback, .valid-feedback').hide();

                    }
                    
                    return isValid;
                }
                
                return true;
            },
            
            /**
             * Obtém todos os dados do formulário como objeto
             */
            getFormData(containerSelector) {
                if (bindings.observables.formData) {
                    return bindings.observables.formData();
                }
                
                const data = {};
                $(containerSelector).find('[data-field-container]').each(function() {
                    const fieldId = $(this).attr('data-field-container');
                    const fieldElement = $(this).find('input, select, textarea').first();
                    if (fieldElement.length) {
                        data[fieldElement.attr('name') || fieldId] = fieldElement.val();
                    }
                });
                
                return data;
            },
            
            validateConfig(config) {
                const defaultFieldConfig = {
                    type: 'text',
                    name: '',
                    id: '',
                    label: '',
                    placeholder: '',
                    value: '',
                    keepValidationOnEmpty: false,
                    required: false,
                    disabled: false,
                    readonly: false,
                    classes: [],
                    attributes: {},
                    validation: {},
                    messages: {},
                    container: null,
                    minSearchLenght: 3,
                    comboboxOptions: {
                        endPoint: '',
                        textField: '',
                        valField: 'id',
                        parentTag: null,
                    },
                    cascadeFrom: [],
                    containerClasses: ['editor-form-field'],
                    labelClasses: ['editor-form-label'],
                    inputClasses: ['form-control'],
                    helpText: '',
                    errorClasses: ['invalid-feedback'],
                    successClasses: ['valid-feedback'],
                    useJqueryValidator: true,
                    useBindings: true,
                    onCreate: null,
                    onChange: null,
                    onFocus: null,
                    onBlur: null,
                    onValidate: null,
                    onInvalid: null,
                    onSubmit: null,
                };
                
                return { ...defaultFieldConfig, ...ctor.defaultConfig, ...config };
            },

            generateFieldId(type) {
                var count = ctor.fieldCounter();
                ctor.fieldCounter(count++);
                return `field_${type}_${ctor.fieldCounter()}_${Date.now()}`;
            },
            
            createFieldStructure(config) {
                const structure = {
                    parent: $('<div></div>'),
                    container: $('<div></div>'),
                    labelElement: null,
                    helpTextElement: null,
                    errorElement: null,
                    successElement: null,
                };
                
                structure.container.addClass('editor-form-input');

                structure.parent
                    .addClass(config.containerClasses.join(' '))
                    .attr('data-field-container', config.id);

                
                if (config.label) {
                    structure.labelElement = $('<div></div>').addClass(config.labelClasses.join(' '));
                    structure.label = $('<label></label>')
                        .addClass('editor-form-label-text')
                        .attr('for', config.id)
                        .html(config.label + (config.required ? ' <span class="text-danger">*</span>' : ''));

                    structure.labelElement.append(structure.label);
                }
                
                if (config.helpText) {
                    structure.helpTextElement = $('<div></div>')
                        .addClass('form-text text-muted')
                        .html(config.helpText);
                }
                
                structure.errorElement = $('<div></div>')
                    .addClass(config.errorClasses.join(' '))
                    .hide();
                    
                structure.successElement = $('<div></div>')
                    .addClass(config.successClasses.join(' '))
                    .hide();
                
                return structure;
            },
            
            createElement(config) {
                const fieldType = ctor.fieldTypes.get(config.type);
                if (!fieldType) {
                    throw new Error(`Tipo de campo '${config.type}' não encontrado`);
                }
                return fieldType.createElement(config);
            },
            
            assembleField(structure, fieldElement, config) {
                const { parent, container, labelElement, helpTextElement, errorElement, successElement } = structure;
                
                if (labelElement) parent.append(labelElement);
                if (helpTextElement) parent.append(helpTextElement);

                container.append(fieldElement);
                container.append(errorElement);
                container.append(successElement);

                parent.append(container);
                
                if (config.container) {
                    $(config.container).append(parent);
                }
                
                return parent;
            },
            
            applyFieldConfig(fieldContainer, config) {
                const fieldElement = fieldContainer.find(`#${config.id}`);
                
                if (config.classes.length > 0) {
                    fieldElement.addClass(config.classes.join(' '));
                }
                
                Object.entries(config.attributes).forEach(([key, value]) => {
                    fieldElement.attr(key, value);
                });
                
                if (config.disabled) fieldElement.prop('disabled', true);
                if (config.readonly) fieldElement.prop('readonly', true);
                if (config.required) fieldElement.prop('required', true);
                
                if (config.animate) {
                    fieldContainer.hide().fadeIn(300);
                }
            },
            
            attachFieldEvents(fieldContainer, config) {
                const fieldElement = fieldContainer.find(`#${config.id}`);
                
                if (config.onCreate && typeof config.onCreate === 'function') {
                    config.onCreate.call(ctor, fieldElement, config);
                }
                
                fieldElement.on('change input', (e) => {
                    if (config.onChange && typeof config.onChange === 'function') {
                        config.onChange.call(ctor, e, fieldElement, config);
                    }
                });
                
                fieldElement.on('focus', (e) => {
                    fieldContainer.addClass('field-focused');
                    if (config.onFocus && typeof config.onFocus === 'function') {
                        config.onFocus.call(ctor, e, fieldElement, config);
                    }
                });
                
                fieldElement.on('blur', (e) => {
                    fieldContainer.removeClass('field-focused');
                    if (config.onBlur && typeof config.onBlur === 'function') {
                        config.onBlur.call(ctor, e, fieldElement, config);
                    }
                    
                    if (config.validateOnBlur) {
                        ctor.validateField(config.id);
                    }
                });
            },
            
            registerFieldType(type, definition) {
                if (!definition.createElement || typeof definition.createElement !== 'function') {
                    throw new Error('createElement é obrigatório para tipos de campo');
                }
                
                ctor.fieldTypes[type] = definition;
            },

            applyBindings: (input, config) => {
                if (config.useBindings) {
                    input.attr('data-bind-value', `${config.id}_value`);
                    input.attr('data-bind-valid', `${config.id}_valid`);
                    if (!bindings.observables[`${config.id}_loading`]) {
                        bindings.observables[`${config.id}_loading`] = bindings.observable(false);
                    };
                };
            },

            applyCascadeFromOptions: (config, input=null, dropdown=null, fetchOptions=null) => {
                if (Array.isArray(config.cascadeFrom)) {
                    config.cascadeFrom.forEach(dep => {
                        const observableId = `${dep}_value`;
                        if (
                            bindings.observables[observableId] &&
                            typeof bindings.observables[observableId].subscribe === 'function'
                        ) {
                            bindings.observables[observableId].subscribe(() => {
                                if (bindings.observables[`${config.id}_value`]) bindings.observables[`${config.id}_value`](null);
                                
                                input.val('');
                                
                                if (typeof fetchOptions === 'function') {
                                    const query = '';
                                    const context = Object.fromEntries(
                                        config.cascadeFrom.map(d => [
                                            d,
                                            bindings.observables[`${d}_value`] ? bindings.observables[`${d}_value`]() : null
                                        ])
                                    );
                                    
                                    const endPoint  = config.comboboxOptions.endPoint;
                                    const textField = config.comboboxOptions.textField;
                                    const valField  = config.comboboxOptions.valField;

                                    fetchOptions(query, dropdown, input, textField, valField, endPoint, context)
                                        .then(items => {
                                            if (typeof renderItems === 'function') renderItems(items, false, false);
                                            if (typeof openDropdown === 'function') openDropdown();
                                        });
                                };
                            });
                        };
                    });
                };
            },
            
            removeField(fieldId) {
                const container = $(`[data-field-container="${fieldId}"]`);
                if (container.length) {
                    // Limpar observables se usando bindings
                    delete bindings.observables[`${fieldId}_value`];
                    delete bindings.observables[`${fieldId}_valid`];
                    delete bindings.observables[`${fieldId}_errors`];
                    delete bindings.observables[`${fieldId}_loading`];
                    
                    // Remover instância
                    ctor.fieldInstances.delete(fieldId);
                    
                    if (ctor.defaultConfig.animate) {
                        container.fadeOut(300, () => container.remove());
                    } else {
                        container.remove();
                    }
                }
            }
        }
    }
)
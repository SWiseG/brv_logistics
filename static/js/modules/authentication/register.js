define(`/static/js/modules/register.js`, null, 
    function Register() {
        return {
            name: `Register`,
            kind: bindings.observable(`module`),
            modules: bindings.observable(null),
            currentStep: bindings.observable(1),
            emailCheckTimeout: bindings.observable(null),
            emailField: bindings.observable(null),
            passwordPrimaryField: bindings.observable(null),
            passwordSecondaryField: bindings.observable(null),
            acceptTermsField: bindings.observable(null),
            phoneField: bindings.observable(null),
            checkEmailURL: bindings.observable(null),
            emailHasBeenValidated: bindings.observable(false),
            compositionComplete: (name, path, dependencies, callback, params) => {
                bindings.reload();
                ctor.checkEmailURL(
                    $('script[module="data-url"][type="check-email"]').attr('data-url-bind')
                );
                ctor.populateFields();
                ctor.applyFieldsSettings();
                return ctor.applyRegisterValidations();
            },

            // ================================
            // STEP NAVIGATION
            // ================================
            nextStep: () => {
                var step = parseInt($(event.currentTarget).attr('data-anotation-step'));
                if (ctor.validateStep(ctor.currentStep())) {
                    ctor.showStep(step);
                    ctor.updateProgress(step);
                    ctor.currentStep(step);
                }
            },
            
            prevStep: () => {
                var step = parseInt($(event.currentTarget).attr('data-anotation-step'));
                ctor.showStep(step);
                ctor.updateProgress(step);
                ctor.currentStep(step);
            },
            
            showStep: (step) => {
                $('.form-step').addClass('d-none');
                $(`.form-step[data-step="${step}"]`).removeClass('d-none');
            },

            updateProgress: (step) => {
                // Update step indicators
                $('.step').each(function(index) {
                    const stepNum = index + 1;
                    if (stepNum < step) {
                        $(this).removeClass('active').addClass('completed');
                    } else if (stepNum === step) {
                        $(this).removeClass('completed').addClass('active');
                    } else {
                        $(this).removeClass('active completed');
                    }
                });
                
                // Update step lines
                $('.step-line').each(function(index) {
                    if (index + 1 < step) {
                        $(this).addClass('completed');
                    } else {
                        $(this).removeClass('completed');
                    }
                });
            },

            validateStep: (step) => {
                ctor.populateFields();
                let isValid = true;
                const stepElement = $(`.form-step[data-step="${step}"]`);
                
                // Clear previous errors
                stepElement.find('.is-invalid').removeClass('is-invalid');
                stepElement.find('.invalid-feedback').text('');
                
                // Validate required fields in current step
                stepElement.find('input[required], select[required]').each(function() {
                    if (!$(this).val().trim()) {
                        $(this).addClass('is-invalid');
                        $(this).siblings('.invalid-feedback').text('Este campo é obrigatório');
                        isValid = false;
                    }
                });
                
                // Step 1 specific validations
                if (step === 1) {
                    const email = ctor.emailField().val();
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    
                    if (email && !emailRegex.test(email) || !ctor.emailHasBeenValidated()) {
                        ctor.emailField().addClass('is-invalid');
                        ctor.emailField().siblings('.invalid-feedback').text('E-mail inválido');
                        isValid = false;
                    }
                }
                
                // Step 2 specific validations
                if (step === 2) {
                    const password1 = ctor.passwordPrimaryField().val();
                    const password2 = ctor.passwordSecondaryField().val();
                    
                    if (password1.length < 8) {
                        ctor.passwordPrimaryField().addClass('is-invalid');
                        ctor.passwordPrimaryField().siblings('.invalid-feedback').text('A senha deve ter pelo menos 8 caracteres');
                        isValid = false;
                    }
                    
                    if (password1 !== password2) {
                        ctor.passwordSecondaryField().addClass('is-invalid');
                        ctor.passwordSecondaryField().siblings('.invalid-feedback').text('As senhas não coincidem');
                        isValid = false;
                    }
                }
                
                // Step 3 specific validations
                if (step === 3) {
                    if (!ctor.acceptTermsField().is(':checked')) {
                        ctor.acceptTermsField().addClass('is-invalid');
                        isValid = false;
                    }
                }
                
                return isValid;
            },

            // ================================
            // FIELDS CHECK
            // ================================
            applyFieldsSettings: () => {
                const Fields = ['email', 'passwordPrimary', 'passwordSecondary', 'phone'];
                Fields.forEach(field => {
                    var $field = ctor[field + 'Field']();
                    if($field?.length > 0) {
                        switch (field) {
                            case 'passwordPrimary':
                                $field.on('input', function() {
                                    const password = $(this).val();
                                    const strengthBar = $('.password-strength');
                                    
                                    let strength = 0;
                                    
                                    // Length check
                                    if (password.length >= 8) strength++;
                                    if (password.length >= 12) strength++;
                                    
                                    // Character variety checks
                                    if (/[a-z]/.test(password)) strength++;
                                    if (/[A-Z]/.test(password)) strength++;
                                    if (/[0-9]/.test(password)) strength++;
                                    if (/[^A-Za-z0-9]/.test(password)) strength++;
                                    
                                    // Update strength indicator
                                    strengthBar.removeClass('weak medium strong');
                                    
                                    if (strength < 3) {
                                        strengthBar.addClass('weak');
                                    } else if (strength < 5) {
                                        strengthBar.addClass('medium');
                                    } else {
                                        strengthBar.addClass('strong');
                                    }
                                });
                                break;
                            case 'passwordSecondary':
                                $field.on('input', function() {
                                    const password1 = ctor.passwordPrimaryField().val();
                                    const password2 = $(this).val();
                                    
                                    if (password2 && password1 !== password2) {
                                        $(this).addClass('is-invalid');
                                        $(this).siblings('.invalid-feedback').text('As senhas não coincidem');
                                    } else {
                                        $(this).removeClass('is-invalid');
                                        $(this).siblings('.invalid-feedback').text('');
                                    }
                                });
                                break;
                            case 'phone':
                                $field.on('input', function() {
                                    let value = $(this).val().replace(/\D/g, '');
                                    
                                    if (value.length <= 10) {
                                        // Telefone fixo: (11) 1234-5678
                                        value = value.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
                                    } else {
                                        // Celular: (11) 99999-9999
                                        value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
                                    }
                                    
                                    $(this).val(value);
                                });
                                break;
                            default:
                                $field.on('input', function() {
                                    const email = $(this).val().trim();
                                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                    
                                    // Hide all indicators
                                    $('.email-check i').addClass('d-none');
                                    
                                    if (email && emailRegex.test(email)) {
                                        // Show loading
                                        $('#emailLoader').removeClass('d-none');
                                        
                                        // Clear previous timeout
                                        clearTimeout(ctor.emailCheckTimeout());
                                        
                                        // Check availability after 500ms
                                        ctor.emailCheckTimeout(
                                            setTimeout(() => {
                                                ctor.checkEmailAvailability(email);
                                            }, 500)
                                        );
                                    }
                                    else if(email === '' || !email) {
                                        $('#emailLoader').addClass('d-none');
                                        $('#emailAvailable').addClass('d-none');
                                        $('#emailTaken').addClass('d-none');
                                        ctor.emailField().removeClass('is-invalid').removeClass('is-valid');
                                    };
                                });
                                break;
                        };
                    };

                });
            },
            
            // ================================
            // EMAIL AVAILABILITY CHECK
            // ================================
            checkEmailAvailability: (email) => {
                $.ajax({
                    url: ctor.checkEmailURL(),
                    method: 'GET',
                    data: { email: email },
                    success: function(response) {
                        $('#emailLoader').addClass('d-none');

                        ctor.populateFields();
                        
                        if (response.available) {
                            $('#emailAvailable').removeClass('d-none');
                            ctor.emailField().removeClass('is-invalid').addClass('is-valid');
                            ctor.emailHasBeenValidated(true);
                        } else {
                            $('#emailTaken').removeClass('d-none');
                            ctor.emailField().removeClass('is-valid').addClass('is-invalid');
                            ctor.emailField().siblings('.invalid-feedback').text(response.message);
                            ctor.emailHasBeenValidated(false);
                        }
                    },
                    error: function() {
                        $('#emailLoader').addClass('d-none');
                    }
                });
            },

            // ================================
            // FORM VALIDATION
            // ================================
            applyRegisterValidations: () => {
                return $('#registerForm').on('submit', ctor.validateRegister);
            },
        
            validateRegister: (e) => {
                e.preventDefault();
                
                
                // Validate all steps
                let allValid = true;
                for (let i = 1; i <= 3; i++) {
                    if (!ctor.validateStep(i)) {
                        allValid = false;
                        // Go to first invalid step
                        if (i < ctor.currentStep()) {
                            ctor.showStep(i);
                            ctor.updateProgress(i);
                            ctor.currentStep(i);
                            break;
                        }
                    }
                }
                
                if (!allValid) {
                    notify.show('form-feedback.invalid', 'error');
                    return;
                };
                
                const form = $('#registerForm');
                const formData = new FormData(form[0]);
                const submitBtn = $('#registerBtn');
                const btnText = submitBtn.find('.btn-text');
                const btnLoading = submitBtn.find('.btn-loading');
                
                // Show loading
                btnText.addClass('d-none');
                btnLoading.removeClass('d-none');
                submitBtn.prop('disabled', true);
                
                // Submit via AJAX
                $.ajax({
                    url: form.attr('action') || window.location.href,
                    method: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    success: function(response) {
                        if (response.success) {
                            notify.show(response.message, 'success');
                            
                            // Redirect after short delay
                            setTimeout(() => {
                                window.location.href = response.redirect_url;
                            }, 1500);
                        } else {
                            // Show errors
                            if (response.errors) {
                                let firstErrorStep = null;
                                
                                Object.keys(response.errors).forEach(field => {
                                    const fieldElement = form.find(`[name="${field}"]`);
                                    const errorMsg = response.errors[field].join(', ');
                                    
                                    fieldElement.addClass('is-invalid');
                                    fieldElement.siblings('.invalid-feedback').text(errorMsg);
                                    
                                    // Find which step has the error
                                    const stepElement = fieldElement.closest('.form-step');
                                    if (stepElement.length) {
                                        const stepNum = parseInt(stepElement.data('step'));
                                        if (!firstErrorStep || stepNum < firstErrorStep) {
                                            firstErrorStep = stepNum;
                                        }
                                    }
                                });
                                
                                // Go to first step with error
                                if (firstErrorStep && firstErrorStep !== ctor.currentStep()) {
                                    ctor.showStep(firstErrorStep);
                                    ctor.updateProgress(firstErrorStep);
                                    ctor.currentStep(firstErrorStep);
                                }
                            }
                            
                            notify.show(response.message || translate._translate('register.error'), 'error');
                        }
                    },
                    error: function(xhr) {
                        console.error(translate._translate('register.error') + ':', xhr);
                        notify.show(translate._translate('register.internal-server-error'), 'error');
                    },
                    complete: function() {
                        // Hide loading
                        btnText.removeClass('d-none');
                        btnLoading.addClass('d-none');
                        submitBtn.prop('disabled', false);
                    }
                });
            },


            // ================================
            // UTILS
            // ================================
            populateFields: () => {
                const Fields = ['email', 'passwordPrimary', 'passwordSecondary', 'phone', 'acceptTerms'];
                return Fields.forEach(field => {
                    var valueComp = ctor[field + 'Field']();
                    if(typeof valueComp === 'string') {
                        var $field = $('#' + valueComp);
                        ctor[field + 'Field']($field);
                    };
                });
            }
        }
    }
)
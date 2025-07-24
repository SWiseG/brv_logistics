define(`/static/js/modules/login.js`, [], 
    function Login() {
        return {
            name: `Login`,
            kind: bindings.observable(`module`),
            modules: bindings.observable(null),
            passwordField: bindings.observable(''),
            emailField: bindings.observable(''),
            compositionComplete: (name, path, dependencies, callback, params) => {
                ctor.applyValidateEmail();
                ctor.socialLoginPlaceholder();
                return ctor.applyLoginValidations();
            },

            // ================================
            // PASSWORD TOGGLE
            // ================================
            togglePassword: (params) => {
                const passwordField = $('#' + ctor.passwordField());
                const icon = params.$element.find('i');
                
                if (passwordField.attr('type') === 'password') {
                    passwordField.attr('type', 'text');
                    icon.removeClass('fa-eye').addClass('fa-eye-slash');
                } else {
                    passwordField.attr('type', 'password');
                    icon.removeClass('fa-eye-slash').addClass('fa-eye');
                }
            },

            // ================================
            // FORM VALIDATION
            // ================================
            applyLoginValidations: () => {
                return $('#loginForm').on('submit', ctor.validateLogin);
            },
        
            validateLogin: (e) => {
                e.preventDefault();
                
                const form = $('#loginForm');
                const formData = new FormData(form[0]);
                const submitBtn = $('#loginBtn');
                const btnText = submitBtn.find('.btn-text');
                const btnLoading = submitBtn.find('.btn-loading');
                
                // Clear previous errors
                form.find('.is-invalid').removeClass('is-invalid');
                form.find('.invalid-feedback').text('');
                
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
                            // Show success message
                            notify.show(response.message, 'success');
                            
                            // Redirect after short delay
                            setTimeout(() => {
                                window.location.href = response.redirect_url;
                            }, 1000);
                        } else {
                            // Show errors
                            if (response.errors) {
                                Object.keys(response.errors).forEach(field => {
                                    const fieldElement = form.find(`[name="${field}"]`);
                                    const errorMsg = response.errors[field].join(', ');
                                    
                                    fieldElement.addClass('is-invalid');
                                    fieldElement.siblings('.invalid-feedback').text(errorMsg);

                                    // if(field === '__all__') logger.log(translate._translate('login.error') + ':', response.errors[field], 'error');
                                });
                            }
                            
                            notify.show(response.message || translate._translate('login.error'), 'error');
                        }
                    },
                    error: function(xhr) {
                        console.error(translate._translate('login.error') + ':', xhr);
                        notify.show(translate._translate('login.internal-server-error'), 'error');
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
            // EMAIL VALIDATION
            // ================================
            applyValidateEmail: () => {
                bindings.reload();
                return $('#' + ctor.emailField()).on('blur', ctor.validateEmail);
            },

            validateEmail: (e) => {
                const $emailField = $(e.target);
                const email = $emailField.val().trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                
                if (email && !emailRegex.test(email)) {
                    $emailField.addClass('is-invalid');
                    $emailField.siblings('.invalid-feedback').text(translate._translate('field-feedback.invalid', ['E-mail']));
                } else {
                    $emailField.removeClass('is-invalid');
                    $emailField.siblings('.invalid-feedback').text('');
                };
            },

            // ================================
            // SOCIAL LOGIN (PLACEHOLDER)
            // ================================
            socialLoginPlaceholder: (params) => {
                if(!params) return false;
                const provider = params.$element.text().trim();
                var msg = translate._translate("login.in-development-state", [provider]);
                notify.show(msg, 'info');
            }
        }
    }
)
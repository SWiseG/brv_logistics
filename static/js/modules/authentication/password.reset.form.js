define(`/static/js/modules/password.reset.form.js`, null, 
    function PasswordResetForm() {
        return {
            name: `PasswordResetForm`,
            kind: bindings.observable(`module`),
            modules: bindings.observable(null),
            compositionComplete: (name, path, dependencies, callback, params) => {
                return ctor.startBindings();
            },

            // ================================
            // PASSWORD TOGGLES
            // ================================
            togglePasswordVisualization: (params) => {
                const passwordField = params.$element.is(`input`) ? params.$element : params.$element.siblings(`input`);
                const icon = passwordField.find('i');
                
                if (passwordField.attr('type') === 'password') {
                    passwordField.attr('type', 'text');
                    icon.removeClass('fa-eye').addClass('fa-eye-slash');
                } else {
                    passwordField.attr('type', 'password');
                    icon.removeClass('fa-eye-slash').addClass('fa-eye');
                }
            },

            // ================================
            // PASSWORD STRENGTH INDICATOR
            // ================================
            subscribeStrenghtPassword: (e) => {
                const $password = $(e.currentTarget);
                const password = $password.val();
                const strengthBar = $password.siblings('.password-strength');
                const strength = ctor.calculatePasswordStrength(password);
                
                strengthBar.removeClass('weak medium strong');
                
                if (password.length === 0) {
                    strengthBar.css('width', '0%');
                } else if (strength < 3) {
                    strengthBar.addClass('weak').css('width', '33%');
                } else if (strength < 5) {
                    strengthBar.addClass('medium').css('width', '66%');
                } else {
                    strengthBar.addClass('strong').css('width', '100%');
                }
                
                // Clear validation errors
                $password.removeClass('is-invalid');
                $password.siblings('.invalid-feedback').text('');
            },

            calculatePasswordStrength: (password) => {
                let strength = 0;
                
                if (password.length >= 8) strength++;
                if (password.match(/[a-z]/)) strength++;
                if (password.match(/[A-Z]/)) strength++;
                if (password.match(/[0-9]/)) strength++;
                if (password.match(/[^a-zA-Z0-9]/)) strength++;
                
                return strength;
            },

            subscribeConfirmPassword: (e) => {
                const $password = $(e.currentTarget);
                const password1 = $('#password1').val();
                const password2 = $password.val();
                
                if (password2 && password1 !== password2) {
                    $password.addClass('is-invalid');
                    $password.siblings('.invalid-feedback').text('As senhas não coincidem');
                } else {
                    $password.removeClass('is-invalid');
                    $password.siblings('.invalid-feedback').text('');
                }
            },

            // ================================
            // CUSTOM BINDINGS
            // ================================
            startBindings: () => {
                $('#password1').on('input', ctor.subscribeStrenghtPassword);
                $('#password2').on('input', ctor.subscribeConfirmPassword);
                $('#passwordForm').on('submit', ctor.send);
            },

            // ================================
            // FORM SUBMISSION
            // ================================
            send: (e) => {
                e.preventDefault();
                
                const form = $('#passwordForm');
                const password1 = $('#password1').val();
                const password2 = $('#password2').val();
                const submitBtn = $('#passwordBtn');
                const btnText = submitBtn.find('.btn-text');
                const btnLoading = submitBtn.find('.btn-loading');
                
                // Clear previous errors
                form.find('.is-invalid').removeClass('is-invalid');
                form.find('.invalid-feedback').text('');
                
                // Validate passwords
                let hasErrors = false;
                
                if (!password1) {
                    $('#password1').addClass('is-invalid');
                    $('#password1').siblings('.invalid-feedback').text('Nova senha é obrigatória');
                    hasErrors = true;
                } else if (password1.length < 8) {
                    $('#password1').addClass('is-invalid');
                    $('#password1').siblings('.invalid-feedback').text('A senha deve ter pelo menos 8 caracteres');
                    hasErrors = true;
                } else if (password1.isdigit && password1.isdigit()) {
                    $('#password1').addClass('is-invalid');
                    $('#password1').siblings('.invalid-feedback').text('A senha não pode conter apenas números');
                    hasErrors = true;
                }
                
                if (!password2) {
                    $('#password2').addClass('is-invalid');
                    $('#password2').siblings('.invalid-feedback').text('Confirmação de senha é obrigatória');
                    hasErrors = true;
                } else if (password1 !== password2) {
                    $('#password2').addClass('is-invalid');
                    $('#password2').siblings('.invalid-feedback').text('As senhas não coincidem');
                    hasErrors = true;
                }
                
                if (hasErrors) {
                    return;
                }
                
                // Show loading
                btnText.addClass('d-none');
                btnLoading.removeClass('d-none');
                submitBtn.prop('disabled', true);
                
                // Submit via AJAX
                $.ajax({
                    url: form.attr('action') || window.location.href,
                    method: 'POST',
                    data: form.serialize(),
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    success: function(response) {
                        if (response.success) {
                            // Show success message
                            notify.show(response.message, 'success');
                            
                            // Redirect after delay
                            setTimeout(() => {
                                window.location.href = response.redirect_url;
                            }, 2000);
                        } else {
                            // Show errors
                            if (response.errors) {
                                Object.keys(response.errors).forEach(field => {
                                    const fieldElement = form.find(`[name="${field}"]`);
                                    const errorMsg = response.errors[field].join(', ');
                                    
                                    fieldElement.addClass('is-invalid');
                                    fieldElement.siblings('.invalid-feedback').text(errorMsg);
                                });
                            }
                            
                            notify.show(response.message || 'Erro ao alterar senha', 'error');
                        }
                    },
                    error: function(xhr) {
                        console.error('Erro ao alterar senha:', xhr);
                        notify.show('Erro interno. Tente novamente.', 'error');
                    },
                    complete: function() {
                        // Hide loading
                        btnText.removeClass('d-none');
                        btnLoading.addClass('d-none');
                        submitBtn.prop('disabled', false);
                    }
                });
            }
        }
    }
)
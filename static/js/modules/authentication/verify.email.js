define(`/static/js/modules/verify.email.js`, [], 
    function VerifyEmail() {
        return {
            name: `VerifyEmail`,
            kind: bindings.observable(`module`),
            modules: bindings.observable(null),
            resendTimer: bindings.observable(60),
            resendEmailURL: bindings.observable(null),
            resendInterval: null,
            compositionComplete: (name, path, dependencies, callback, params) => {
                // Auto-focus and select on page load
                $('#verification_code').focus().select();
                ctor.resendEmailURL(
                    $('script[module="data-url"][type="check-email"]').attr('data-url-bind')
                );
                ctor.startBindings();
                ctor.applyShortcuts();

                // Start initial timer
                return ctor.startResendTimer();
            },
            
            // ================================
            // COUNTDOWN TIMER
            // ================================
            startResendTimer: () => {
                ctor.resendTimer(60);
                $('#resendBtn').prop('disabled', true);
                $('#resendTimer').show();
                
                ctor.resendInterval = setInterval(() => {
                    let newTimer = parseInt(ctor.resendTimer()) - 1;
                    ctor.resendTimer(newTimer);
                    $('#countdown').text(ctor.resendTimer());
                    
                    if (ctor.resendTimer() <= 0) {
                        clearInterval(ctor.resendInterval);
                        $('#resendBtn').prop('disabled', false);
                        $('#resendTimer').hide();
                    }
                }, 1000);
            },

            // ================================
            // CUSTOM BINDINGS
            // ================================
            startBindings: () => {
                $('#verification_code').on('input', ctor.subscribeCode);
                $('#verificationForm').on('submit', ctor.send);
                
                // Prevent non-numeric input
                $('#verification_code').on('keypress', function(e) {
                    if (!/\d/.test(String.fromCharCode(e.which)) && e.which !== 8) {
                        e.preventDefault();
                    }
                });
            },

            // ================================
            // KEYBOARD SHORTCUTS
            // ================================
            applyShortcuts: () => {
                $(document).on('keydown', function(e) {
                    // Enter to submit
                    if (e.key === 'Enter' && $('#verification_code').is(':focus')) {
                        $('#verificationForm').submit();
                    }
                    
                    // Escape to go back
                    if (e.key === 'Escape') {
                        history.back();
                    }
                });
            },

            // ================================
            // CODE INPUT FORMATTING
            // ================================
            subscribeCode: () => {
                var $input = $('#verification_code');
                let value = $input.val().replace(/\D/g, ''); // Only digits
                $input.val(value);
                
                // Auto-submit when 6 digits are entered
                if (value.length === 6) {
                    setTimeout(() => {
                        $('#verificationForm').submit();
                    }, 500);
                }
                
                // Clear error state
                $input.removeClass('is-invalid');
                $input.siblings('.invalid-feedback').text('');
            },

            // ================================
            // FORM SUBMISSION
            // ================================
            send: (e) => {
                e.preventDefault();
                
                const form = $('#verificationForm');
                const code = $('#verification_code').val().trim();
                const submitBtn = $('#verifyBtn');
                const btnText = submitBtn.find('.btn-text');
                const btnLoading = submitBtn.find('.btn-loading');
                
                // Validate code
                if (!code || code.length !== 6) {
                    $('#verification_code').addClass('is-invalid');
                    $('#verification_code').siblings('.invalid-feedback').text('Digite um código de 6 dígitos');
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
                            // Show success
                            notify.show(response.message, 'success');
                            
                            // Clear timer
                            clearInterval(ctor.resendInterval);
                            
                            // Redirect after delay
                            setTimeout(() => {
                                window.location.href = response.redirect_url || '/';
                            }, 1500);
                        } else {
                            // Show error
                            $('#verification_code').addClass('is-invalid');
                            $('#verification_code').siblings('.invalid-feedback').text(response.message);
                            
                            // Shake animation
                            $('#verification_code').focus().select();
                            
                            notify.show(response.message, 'error');
                        }
                    },
                    error: function(xhr) {
                        console.error('Erro na verificação:', xhr);
                        notify.show('Erro interno. Tente novamente.', 'error');
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
            // RESEND CODE
            // ================================
            resendCode: (params) => {
                if(!params) return;
                const button = params.$element;
                
                if (button.prop('disabled')) return;
                
                // Show loading
                button.prop('disabled', true).text('Enviando...');
                
                $.ajax({
                    url: ctor.resendEmailURL(),
                    method: 'POST',
                    data: {
                        'csrfmiddlewaretoken': $('[name=csrfmiddlewaretoken]').val(),
                        'verification_resend': 'True'
                    },
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    success: function(response) {
                        if (response.success) {
                            notify.show(response.message, 'success');
                            
                            // Reset timer
                            ctor.startResendTimer();
                            
                            // Clear and focus input
                            button.prop('disabled', true).text('Reenviar código');
                            $('#verification_code').val('').focus();
                        } else {
                            notify.show(response.message, 'error');
                            button.prop('disabled', false).text('Reenviar código');
                        }
                    },
                    error: function(xhr) {
                        console.error('Erro ao reenviar:', xhr);
                        notify.show('Erro ao reenviar código.', 'error');
                        button.prop('disabled', false).text('Reenviar código');
                    }
                });
            }
        }
    }
)
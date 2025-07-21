define(`/static/js/modules/password.reset.request.js`, null, 
    function PasswordResetRequest() {
        return {
            name: `PasswordResetRequest`,
            kind: bindings.observable(`module`),
            modules: bindings.observable(null),
            compositionComplete: (name, path, dependencies, callback, params) => {
                return ctor.startBindings();
            },

            subscribeEmail: (e) => {
                const $email = $(e.currentTarget);
                const email = $email.val().trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                
                if (email && !emailRegex.test(email)) {
                    $email.addClass('is-invalid');
                    $email.siblings('.invalid-feedback').text('E-mail inválido');
                } else {
                    $email.removeClass('is-invalid');
                    $email.siblings('.invalid-feedback').text('');
                }
            },

            // ================================
            // CUSTOM BINDINGS
            // ================================
            startBindings: () => {
                $('#email').on('blur', ctor.subscribeEmail);
                $('#resetForm').on('submit', ctor.send);
            },

            
            // ================================
            // FORM SUBMISSION
            // ================================
            send: (e) => {
                e.preventDefault();
                
                const form = $("#resetForm");
                const email = $('#email').val().trim();
                const submitBtn = $('#resetBtn');
                const btnText = submitBtn.find('.btn-text');
                const btnLoading = submitBtn.find('.btn-loading');
                
                // Clear previous errors
                form.find('.is-invalid').removeClass('is-invalid');
                form.find('.invalid-feedback').text('');
                
                // Validate email
                if (!email) {
                    $('#email').addClass('is-invalid');
                    $('#email').siblings('.invalid-feedback').text('E-mail é obrigatório');
                    return;
                }
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    $('#email').addClass('is-invalid');
                    $('#email').siblings('.invalid-feedback').text('E-mail inválido');
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
                            }, 1500);
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
                            
                            notify.show(response.message || 'Erro na solicitação', 'error');
                        }
                    },
                    error: function(xhr) {
                        console.error('Erro na solicitação:', xhr);
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
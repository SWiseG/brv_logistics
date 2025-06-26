from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.views.generic import TemplateView, View
from django.http import JsonResponse
from django.urls import reverse
from django.db import transaction
from django.utils import timezone

from django.contrib.auth.models import Group
from users.models import Address, User, EmailVerification, UserLoginAttempt, UserPasswordChange
from users.forms import *
from .utils import EmailService

# region Auth
class LoginView(View):
    """View customizada para login com verificação de segurança"""
    template_name = 'modules/authentication/login.html'
    
    def get(self, request):
        if request.user.is_authenticated:
            next_url = request.GET.get('next', '/')
            return redirect(next_url)
        
        form = CustomAuthenticationForm()
        context = {
            'form': form,
            'title': 'Login', 
            'next': request.GET.get('next', ''),
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        form = CustomAuthenticationForm(data=request.POST)
        next_url = request.POST.get('next', request.GET.get('next', '/'))
        
        if form.is_valid():
            email = form.cleaned_data.get('username').lower()
            password = form.cleaned_data.get('password')
            remember_me = request.POST.get('remember_me')
            ip_address = self.get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            # Verificar requisitos de segurança
            requires_verification = UserLoginAttempt.check_security_requirements(email, ip_address)
            
            # Tentar autenticar
            user = authenticate(request, username=email, password=password)
            
            if user is not None:
                if user.is_active:
                    if requires_verification:
                        # ENVIAR ALERTA DE SEGURANÇA
                        EmailService.send_security_alert(user, ip_address, user_agent)
                        
                        # Requer verificação adicional
                        verification = EmailVerification.create_verification(
                            email=email,
                            verification_type='login_verification'
                        )
                        
                        # Enviar código de verificação
                        email_sent = EmailService.send_verification_code(
                            email=email,
                            code=verification.verification_code,
                            user_name=user.first_name,
                            verification_type='login_verification'
                        )
                        
                        if email_sent:
                            # Registrar tentativa com verificação
                            UserLoginAttempt.objects.create(
                                email=email,
                                ip_address=ip_address,
                                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                                success=False,
                                failure_reason='verification_required',
                                requires_verification=True,
                                verification_sent=True
                            )
                            
                            # Salvar na sessão para após verificação
                            request.session['verification_email'] = email
                            request.session['verification_type'] = 'login_verification'
                            request.session['next_url'] = next_url
                            
                            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                                return JsonResponse({
                                    'success': True,
                                    'requires_verification': True,
                                    'redirect_url': reverse('auth:verify_email'),
                                    'message': 'Verificação de segurança necessária. Código enviado por email.'
                                })
                            
                            messages.info(request, 'Por segurança, enviamos um código para seu email.')
                            return redirect('auth:verify_email')
                        else:
                            messages.error(request, 'Erro ao enviar código de verificação.')
                    else:
                        # Login normal - verificar se é um novo IP
                        recent_ips = UserLoginAttempt.objects.filter(
                            email__iexact=email,
                            success=True,
                            attempted_at__gte=timezone.now() - timezone.timedelta(days=30)
                        ).values_list('ip_address', flat=True).distinct()
                        
                        # Se é um IP novo (mas não requer verificação), enviar alerta informativo
                        if recent_ips and ip_address not in recent_ips:
                            EmailService.send_new_login_notification(user, ip_address, user_agent)
                        
                        login(request, user)
                        
                        # Configurar duração da sessão
                        if not remember_me:
                            request.session.set_expiry(0)
                        else:
                            request.session.set_expiry(1209600)  # 2 semanas
                        
                        # Registrar login bem-sucedido
                        UserLoginAttempt.objects.create(
                            email=email,
                            ip_address=ip_address,
                            user_agent=request.META.get('HTTP_USER_AGENT', ''),
                            success=True
                        )
                        
                        messages.success(request, f'Bem-vindo de volta, {user.first_name or user.username}!')
                        
                        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                            return JsonResponse({
                                'success': True,
                                'redirect_url': next_url or '/',
                                'message': 'Login realizado com sucesso!'
                            })
                        
                        return redirect(next_url or '/')
                else:
                    # Registrar tentativa com conta inativa
                    UserLoginAttempt.objects.create(
                        email=email,
                        ip_address=ip_address,
                        user_agent=request.META.get('HTTP_USER_AGENT', ''),
                        success=False,
                        failure_reason='account_inactive'
                    )
                    messages.error(request, 'Sua conta está inativa. Entre em contato com o suporte.')
            else:
                # Registrar tentativa com credenciais inválidas
                UserLoginAttempt.objects.create(
                    email=email,
                    ip_address=ip_address,
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    success=False,
                    failure_reason='invalid_credentials'
                )
                messages.error(request, 'E-mail ou senha incorretos.')
        else:
            messages.error(request, 'Por favor, corrija os erros abaixo.')
        
        # AJAX response para erros
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': False,
                'errors': form.errors,
                'message': 'Erro no login. Verifique os dados.'
            })
        
        context = {
            'form': form,
            'next': next_url,
        }
        return render(request, self.template_name, context)
    
    def get_client_ip(self, request):
        """Obtém IP do cliente"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class RegisterView(View):
    """View para registro de usuários com verificação por email"""
    template_name = 'modules/authentication/register.html'
    
    def get(self, request):
        if request.user.is_authenticated:
            return redirect('/')
        
        form = CustomUserCreationForm()
        context = {'form': form, 'title': 'Registrar' }
        return render(request, self.template_name, context)
    
    def post(self, request):
        form = CustomUserCreationForm(request.POST)
        
        if form.is_valid():
            try:
                # Preparar dados do usuário para armazenamento temporário
                temp_user_data = {
                    'first_name': form.cleaned_data['first_name'],
                    'last_name': form.cleaned_data['last_name'],
                    'email': form.cleaned_data['email'].lower(),
                    'password': form.cleaned_data['password1'],  # Hash será aplicado na verificação
                    'phone': form.cleaned_data.get('phone', ''),
                    'date_of_birth': form.cleaned_data.get('date_of_birth').isoformat() if form.cleaned_data.get('date_of_birth') else None,
                    'newsletter_subscribed': form.cleaned_data.get('newsletter_subscribed', False),
                }
                
                # Verificar se email já existe
                from users.models import User as usuario
                if usuario.objects.filter(email__iexact=temp_user_data['email']).exists():
                    messages.error(request, 'Este email já está cadastrado.')
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return JsonResponse({
                            'success': False,
                            'message': 'Este email já está cadastrado.'
                        })
                    return render(request, self.template_name, {'form': form})
                
                # Criar verificação por email
                verification = EmailVerification.create_verification(
                    email=temp_user_data['email'],
                    verification_type='registration',
                    temp_data=temp_user_data
                )
                
                # Enviar email com código
                email_sent = EmailService.send_verification_code(
                    email=temp_user_data['email'],
                    code=verification.verification_code,
                    user_name=temp_user_data['first_name'],
                    verification_type='registration'
                )
                
                if email_sent:
                    # Redirecionar para tela de verificação
                    request.session['verification_email'] = temp_user_data['email']
                    request.session['verification_type'] = 'registration'
                    
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return JsonResponse({
                            'success': True,
                            'redirect_url': reverse('auth:verify_email'),
                            'message': 'Código de verificação enviado para seu email!'
                        })
                    
                    messages.success(request, 'Código de verificação enviado para seu email!')
                    return redirect('auth:verify_email')
                else:
                    messages.error(request, 'Erro ao enviar email. Tente novamente.')
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return JsonResponse({
                            'success': False,
                            'message': 'Erro ao enviar email. Tente novamente.'
                        })
                    
            except Exception as e:
                print(f"Erro no registro: {e}")
                messages.error(request, 'Erro interno. Tente novamente.')
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'message': 'Erro interno. Tente novamente.'
                    })
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'errors': form.errors,
                    'message': 'Corrija os erros no formulário.'
                })
        
        context = {'form': form}
        return render(request, self.template_name, context)
    
class LogoutView(View):
    """View para logout"""
    
    def get(self, request):
        logout(request)
        messages.success(request, 'Logout realizado com sucesso!')
        return redirect('auth:login')
    
    def post(self, request):
        logout(request)
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'redirect_url': reverse('auth:login'),
                'message': 'Logout realizado com sucesso!'
            })
        
        messages.success(request, 'Logout realizado com sucesso!')
        return redirect('auth:login')
# endregion Auth

# region Email
class CheckEmailView(View):
    """View para verificar se email já existe (AJAX)"""
    
    def get(self, request):
        email = request.GET.get('email', '').strip().lower()
        
        if not email:
            return JsonResponse({'available': False, 'message': 'E-mail é obrigatório'})
        
        # Verificar se email já existe
        from users.models import User as usuario
        exists = usuario.objects.filter(email__iexact=email).exists()
        
        return JsonResponse({
            'available': not exists,
            'message': 'E-mail já cadastrado' if exists else 'E-mail disponível'
        })

class EmailVerificationView(View):
    """View para verificação do código de email"""
    template_name = 'modules/authentication/verify_email.html'
    
    def get(self, request):
        email = request.session.get('verification_email')
        verification_type = request.session.get('verification_type', 'registration')
        
        if not email:
            messages.error(request, 'Sessão de verificação inválida.')
            return redirect('auth:register')
        
        context = {
            'email': email,
            'verification_type': verification_type,
            'title': 'Verificar Email', 
            'masked_email': self.mask_email(email)
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        email = request.session.get('verification_email')
        verification_type = request.session.get('verification_type', 'registration')
        code = request.POST.get('verification_code', '').strip()
        resend_request = bool(request.POST.get('verification_resend', False))
        
        if resend_request and email:
            # Buscar verificação ativa
            verification = EmailVerification.objects.filter(
                email__iexact=email,
                verification_type=verification_type,
                is_active=True
            ).order_by('-created_at').first()
            
            if verification:
                # Reenviar email com código
                email_sent = EmailService.send_verification_code(
                    email=email,
                    code=verification.verification_code,
                    user_name=verification.temp_user_data['first_name'],
                    verification_type='registration'
                )
                
                if email_sent:
                    response_data = {
                        'success': True,
                        'message': 'Código de verificação reenviado com sucesso.'
                    }
                    
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return JsonResponse(response_data)
                    
                    messages.error(request, response_data['message'])
                    return redirect('auth:verify_email')
            else:
                response_data = {
                    'success': False,
                    'message': 'Código de verificação não encontrado ou expirado.'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.error(request, response_data['message'])
                return redirect('auth:register')
            
            
        
        if not email or not code:
            response_data = {
                'success': False,
                'message': 'Email ou código inválido.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return redirect('auth:verify_email')
        
        try:
            # Buscar verificação ativa
            verification = EmailVerification.objects.filter(
                email__iexact=email,
                verification_type=verification_type,
                is_active=True
            ).order_by('-created_at').first()
            
            if not verification:
                response_data = {
                    'success': False,
                    'message': 'Código de verificação não encontrado ou expirado.'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.error(request, response_data['message'])
                return redirect('auth:verify_email')
            
            # Verificar código
            success, message = verification.verify(code)
            
            if success:
                if verification_type == 'registration':
                    # Criar usuário
                    user = self.create_user_from_verification(verification)
                    
                    if user:
                        # Fazer login automático
                        login(request, user)
                        
                        # Limpar sessão
                        if 'verification_email' in request.session:
                            del request.session['verification_email']
                        if 'verification_type' in request.session:
                            del request.session['verification_type']
                        
                        response_data = {
                            'success': True,
                            'redirect_url': '/',
                            'message': f'Conta criada com sucesso! Bem-vindo, {user.first_name}!'
                        }
                        
                        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                            return JsonResponse(response_data)
                        
                        messages.success(request, response_data['message'])
                        return redirect('/')
                    else:
                        response_data = {
                            'success': False,
                            'message': 'Erro ao criar conta. Tente novamente.'
                        }
                elif verification_type == 'login_verification':
                    # Completar login com verificação
                    return self.complete_verified_login(request, email)
                elif verification_type == 'password_reset':
                    # Redirecionar para redefinição de senha
                    request.session['reset_email_verified'] = email
                    response_data = {
                        'success': True,
                        'redirect_url': reverse('auth:password_reset_form'),
                        'message': 'Email verificado! Defina sua nova senha.'
                    }
                
            else:
                response_data = {
                    'success': False,
                    'message': message
                }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            if response_data['success']:
                messages.success(request, response_data['message'])
                return redirect(response_data.get('redirect_url', '/'))
            else:
                messages.error(request, response_data['message'])
                return redirect('auth:verify_email')
                
        except Exception as e:
            print(f"Erro na verificação: {e}")
            response_data = {
                'success': False,
                'message': 'Erro interno. Tente novamente.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return redirect('auth:verify_email')
    
    def create_user_from_verification(self, verification):
        """Cria usuário a partir dos dados da verificação"""
        try:
            with transaction.atomic():
                user_data = verification.temp_user_data
                
                # Criar usuário
                user = User.objects.create_user(
                    username=user_data['email'],
                    email=user_data['email'],
                    password=user_data['password'],
                    first_name=user_data['first_name'],
                    last_name=user_data['last_name'],
                    is_active=True
                )
                
                # Criar perfil
                group, created = Group.objects.get_or_create(name='Visitante')
                user.groups.add(group)
                
                # ENVIAR EMAIL DE BOAS-VINDAS
                EmailService.send_welcome_email(user)
                
                return user
                
        except Exception as e:
            print(f"Erro ao criar usuário: {e}")
            return None
    
    def complete_verified_login(self, request, email):
        """Completa login após verificação de email"""
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            login(request, user)
            
            # Limpar sessão
            if 'verification_email' in request.session:
                del request.session['verification_email']
            if 'verification_type' in request.session:
                del request.session['verification_type']
            
            # Registrar login bem-sucedido
            UserLoginAttempt.objects.create(
                email=email,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                success=True
            )
            
            response_data = {
                'success': True,
                'redirect_url': request.session.get('next_url', '/'),
                'message': f'Login realizado com sucesso! Bem-vindo, {user.first_name}!'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.success(request, response_data['message'])
            return redirect(response_data['redirect_url'])
            
        except User.DoesNotExist:
            response_data = {
                'success': False,
                'message': 'Usuário não encontrado.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return redirect('auth:login')
    
    def mask_email(self, email):
        """Mascara o email para exibição"""
        if '@' not in email:
            return email
        
        local, domain = email.split('@')
        if len(local) <= 2:
            masked_local = '*' * len(local)
        else:
            masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
        
        return f"{masked_local}@{domain}"
    
    def get_client_ip(self, request):
        """Obtém IP do cliente"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
# endregion Email

# region Password
class PasswordResetRequestView(View):
    """Solicitar redefinição de senha"""
    template_name = 'modules/authentication/password_reset_request.html'
    
    def get(self, request):
        # Se já está logado, redirecionar
        if request.user.is_authenticated:
            return redirect('auth:profile')
        
        return render(request, self.template_name, {'title': 'Recuperar Senha'})
    
    def post(self, request):
        email = request.POST.get('email', '').strip().lower()
        
        if not email:
            response_data = {
                'success': False,
                'message': 'E-mail é obrigatório.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return render(request, self.template_name)
        
        # Validar formato do email
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError
        
        try:
            validate_email(email)
        except ValidationError:
            response_data = {
                'success': False,
                'message': 'Formato de e-mail inválido.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return render(request, self.template_name)
        
        try:
            # Verificar se usuário existe e está ativo
            user = User.objects.get(email__iexact=email, is_active=True)
            
            # Verificar rate limiting (máximo 3 tentativas por hora)
            recent_requests = EmailVerification.objects.filter(
                email__iexact=email,
                verification_type='password_reset',
                created_at__gte=timezone.now() - timezone.timedelta(hours=1)
            ).count()
            
            if recent_requests >= 3:
                response_data = {
                    'success': False,
                    'message': 'Muitas tentativas. Tente novamente em 1 hora.'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.error(request, response_data['message'])
                return render(request, self.template_name)
            
            # Criar verificação para reset de senha
            verification = EmailVerification.create_verification(
                email=email,
                verification_type='password_reset'
            )
            
            # Enviar email com código
            email_sent = EmailService.send_verification_code(
                email=email,
                code=verification.verification_code,
                user_name=user.first_name,
                verification_type='password_reset'
            )
            
            if email_sent:
                # Salvar na sessão para próxima etapa
                request.session['reset_email'] = email
                request.session['verification_type'] = 'password_reset'
                
                response_data = {
                    'success': True,
                    'redirect_url': reverse('auth:verify_reset_code'),
                    'message': 'Código de verificação enviado para seu e-mail!'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.success(request, response_data['message'])
                return redirect('auth:verify_reset_code')
            else:
                response_data = {
                    'success': False,
                    'message': 'Erro ao enviar e-mail. Tente novamente.'
                }
                
        except User.DoesNotExist:
            # Por segurança, não revelar se o email existe ou não
            # Simular sucesso mas não enviar email
            response_data = {
                'success': True,
                'redirect_url': reverse('auth:verify_reset_code'),
                'message': 'Se o e-mail existir, você receberá um código de verificação.'
            }
            
            # Mesmo assim, salvar na sessão para manter fluxo
            request.session['reset_email'] = email
            request.session['verification_type'] = 'password_reset'
            
        except Exception as e:
            print(f"Erro na solicitação de reset: {e}")
            response_data = {
                'success': False,
                'message': 'Erro interno. Tente novamente.'
            }
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse(response_data)
        
        if response_data['success']:
            if 'message' in response_data:
                messages.success(request, response_data['message'])
            return redirect(response_data.get('redirect_url', '/'))
        else:
            messages.error(request, response_data['message'])
            return render(request, self.template_name)
        
class ResendVerificationView(View):
    """View para reenviar código de verificação"""
    
    def post(self, request):
        email = request.session.get('verification_email')
        verification_type = request.session.get('verification_type', 'registration')
        
        if not email:
            return JsonResponse({
                'success': False,
                'message': 'Sessão de verificação inválida.'
            })
        
        try:
            # Verificar se pode reenviar (não mais que 3 por hora)
            recent_verifications = EmailVerification.objects.filter(
                email__iexact=email,
                verification_type=verification_type,
                created_at__gte=timezone.now() - timezone.timedelta(hours=1)
            ).count()
            
            if recent_verifications >= 3:
                return JsonResponse({
                    'success': False,
                    'message': 'Muitos códigos enviados. Tente novamente em 1 hora.'
                })
            
            # Buscar verificação mais recente para obter dados temporários
            last_verification = EmailVerification.objects.filter(
                email__iexact=email,
                verification_type=verification_type
            ).order_by('-created_at').first()
            
            temp_data = last_verification.temp_user_data if last_verification else {}
            
            # Criar nova verificação
            verification = EmailVerification.create_verification(
                email=email,
                verification_type=verification_type,
                temp_data=temp_data
            )
            
            # Enviar novo código
            email_sent = EmailService.send_verification_code(
                email=email,
                code=verification.verification_code,
                user_name=temp_data.get('first_name', ''),
                verification_type=verification_type
            )
            
            if email_sent:
                return JsonResponse({
                    'success': True,
                    'message': 'Novo código enviado para seu email!'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'message': 'Erro ao enviar email. Tente novamente.'
                })
                
        except Exception as e:
            print(f"Erro ao reenviar código: {e}")
            return JsonResponse({
                'success': False,
                'message': 'Erro interno. Tente novamente.'
            })

class VerifyResetCodeView(View):
    """Verificar código para reset de senha"""
    template_name = 'modules/authentication/verify_reset_code.html'
    
    def get(self, request):
        email = request.session.get('reset_email')
        
        if not email:
            messages.error(request, 'Sessão de redefinição inválida.')
            return redirect('auth:password_reset')
        
        context = {
            'email': email,
            'title': 'Verificar Código', 
            'masked_email': self.mask_email(email)
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        email = request.session.get('reset_email')
        code = request.POST.get('verification_code', '').strip()
        
        if not email or not code:
            response_data = {
                'success': False,
                'message': 'Sessão inválida ou código não fornecido.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return redirect('auth:password_reset')
        
        try:
            # Buscar verificação ativa
            verification = EmailVerification.objects.filter(
                email__iexact=email,
                verification_type='password_reset',
                is_active=True
            ).order_by('-created_at').first()
            
            if not verification:
                response_data = {
                    'success': False,
                    'message': 'Código de verificação não encontrado ou expirado.'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.error(request, response_data['message'])
                return redirect('auth:verify_reset_code')
            
            # Verificar código
            success, message = verification.verify(code)
            
            if success:
                # Código válido - prosseguir para definição de nova senha
                request.session['reset_code_verified'] = True
                request.session['reset_verification_id'] = verification.id
                
                response_data = {
                    'success': True,
                    'redirect_url': reverse('auth:password_reset_form'),
                    'message': 'Código verificado! Defina sua nova senha.'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.success(request, response_data['message'])
                return redirect('auth:password_reset_form')
            else:
                response_data = {
                    'success': False,
                    'message': message
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.error(request, response_data['message'])
                return redirect('auth:verify_reset_code')
                
        except Exception as e:
            print(f"Erro na verificação do código: {e}")
            response_data = {
                'success': False,
                'message': 'Erro interno. Tente novamente.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return redirect('auth:verify_reset_code')
    
    def mask_email(self, email):
        """Mascara o email para exibição"""
        if '@' not in email:
            return email
        
        local, domain = email.split('@')
        if len(local) <= 2:
            masked_local = '*' * len(local)
        else:
            masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
        
        return f"{masked_local}@{domain}"

class PasswordResetFormView(View):
    """Formulário para definir nova senha"""
    template_name = 'modules/authentication/password_reset_form.html'
    
    def get(self, request):
        # Verificar se chegou aqui através do fluxo correto
        if not all([
            request.session.get('reset_email'),
            request.session.get('reset_code_verified'),
            request.session.get('reset_verification_id')
        ]):
            messages.error(request, 'Acesso inválido. Inicie o processo novamente.')
            return redirect('auth:password_reset')
        
        context = {
            'email': request.session.get('reset_email'),
            'title': 'Resetar Senha', 
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        # Verificar sessão
        email = request.session.get('reset_email')
        code_verified = request.session.get('reset_code_verified')
        verification_id = request.session.get('reset_verification_id')
        
        if not all([email, code_verified, verification_id]):
            response_data = {
                'success': False,
                'message': 'Sessão inválida. Inicie o processo novamente.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return redirect('auth:password_reset')
        
        # Obter dados do formulário
        password1 = request.POST.get('password1', '').strip()
        password2 = request.POST.get('password2', '').strip()
        
        # Validações
        errors = {}
        
        if not password1:
            errors['password1'] = 'Senha é obrigatória.'
        elif len(password1) < 8:
            errors['password1'] = 'A senha deve ter pelo menos 8 caracteres.'
        elif password1.isdigit():
            errors['password1'] = 'A senha não pode conter apenas números.'
        elif password1.lower() in ['12345678', 'password', 'senha123', 'password123']:
            errors['password1'] = 'Esta senha é muito comum.'
        
        if not password2:
            errors['password2'] = 'Confirmação de senha é obrigatória.'
        elif password1 != password2:
            errors['password2'] = 'As senhas não coincidem.'
        
        if errors:
            response_data = {
                'success': False,
                'errors': errors,
                'message': 'Corrija os erros no formulário.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            for field, error in errors.items():
                messages.error(request, error)
            
            return render(request, self.template_name, {'email': email})
        
        try:
            # Verificar se a verificação ainda é válida
            verification = EmailVerification.objects.filter(
                id=verification_id,
                email__iexact=email,
                verification_type='password_reset',
                is_used=True,  # Deve estar marcada como usada
                verified_at__isnull=False
            ).first()
            
            if not verification:
                response_data = {
                    'success': False,
                    'message': 'Verificação inválida. Inicie o processo novamente.'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.error(request, response_data['message'])
                return redirect('auth:password_reset')
            
            # Verificar se não passou muito tempo desde a verificação (30 minutos)
            if verification.verified_at < timezone.now() - timezone.timedelta(minutes=30):
                response_data = {
                    'success': False,
                    'message': 'Verificação expirada. Inicie o processo novamente.'
                }
                
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse(response_data)
                
                messages.error(request, response_data['message'])
                return redirect('auth:password_reset')
            
            # Buscar usuário e alterar senha
            user = User.objects.get(email__iexact=email, is_active=True)
            user.set_password(password1)
            user.save()
            
            # Invalidar todas as verificações de reset pendentes para este usuário
            EmailVerification.objects.filter(
                email__iexact=email,
                verification_type='password_reset',
                is_active=True
            ).update(is_active=False)
            
            # Registrar alteração de senha
            UserPasswordChange.objects.create(
                user=user,
                changed_by=user,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                change_method='reset_by_email'
            )
            
            # Limpar sessão
            session_keys = ['reset_email', 'reset_code_verified', 'reset_verification_id', 'verification_type']
            for key in session_keys:
                if key in request.session:
                    del request.session[key]
            
            # Enviar email de confirmação
            EmailService.send_password_changed_notification(user, self.get_client_ip(request))
            
            response_data = {
                'success': True,
                'redirect_url': reverse('auth:login'),
                'message': 'Senha alterada com sucesso! Faça login com sua nova senha.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.success(request, response_data['message'])
            return redirect('auth:login')
            
        except User.DoesNotExist:
            response_data = {
                'success': False,
                'message': 'Usuário não encontrado.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return redirect('auth:password_reset')
            
        except Exception as e:
            print(f"Erro ao alterar senha: {e}")
            response_data = {
                'success': False,
                'message': 'Erro interno. Tente novamente.'
            }
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse(response_data)
            
            messages.error(request, response_data['message'])
            return render(request, self.template_name, {'email': email})
    
    def get_client_ip(self, request):
        """Obtém IP do cliente"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class ResendResetCodeView(View):
    """Reenviar código para reset de senha"""
    
    def post(self, request):
        email = request.session.get('reset_email')
        
        if not email:
            return JsonResponse({
                'success': False,
                'message': 'Sessão de redefinição inválida.'
            })
        
        try:
            # Verificar rate limiting
            recent_codes = EmailVerification.objects.filter(
                email__iexact=email,
                verification_type='password_reset',
                created_at__gte=timezone.now() - timedelta(hours=1)
            ).count()
            
            if recent_codes >= 3:
                return JsonResponse({
                    'success': False,
                    'message': 'Muitos códigos enviados. Tente novamente em 1 hora.'
                })
            
            # Verificar se usuário existe
            user = User.objects.get(email__iexact=email, is_active=True)
            
            # Criar nova verificação
            verification = EmailVerification.create_verification(
                email=email,
                verification_type='password_reset'
            )
            
            # Enviar novo código
            email_sent = EmailService.send_verification_code(
                email=email,
                code=verification.verification_code,
                user_name=user.first_name,
                verification_type='password_reset'
            )
            
            if email_sent:
                return JsonResponse({
                    'success': True,
                    'message': 'Novo código enviado para seu e-mail!'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'message': 'Erro ao enviar e-mail. Tente novamente.'
                })
                
        except User.DoesNotExist:
            # Por segurança, não revelar se o email existe
            return JsonResponse({
                'success': True,
                'message': 'Se o e-mail existir, você receberá um novo código.'
            })
            
        except Exception as e:
            print(f"Erro ao reenviar código: {e}")
            return JsonResponse({
                'success': False,
                'message': 'Erro interno. Tente novamente.'
            })
# endregion Password

# region Profile    
class ProfileView(LoginRequiredMixin, TemplateView):
    """View do perfil do usuário"""
    template_name = 'modules/authentication/profile.html'
    login_url = 'auth:login'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        # Buscar ou criar perfil
        profile, created = Group.objects.get_or_create(user=user)
        
        # Buscar endereços
        addresses = Address.objects.filter(user=user).order_by('-is_default', 'created_at')
        
        context.update({
            'profile': profile,
            'addresses': addresses,
            'total_orders': user.orders.count() if hasattr(user, 'orders') else 0,
        })
        
        return context

class EditProfileView(LoginRequiredMixin, View):
    """View para editar perfil"""
    template_name = 'modules/authentication/edit_profile.html'
    login_url = 'auth:login'
    
    def get(self, request):
        user = request.user
        profile, created = Group.objects.get_or_create(user=user)
        
        user_form = UserUpdateForm(instance=user)
        
        context = {
            'user_form': user_form
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        user = request.user
        profile, created = Group.objects.get_or_create(user=user)
        
        user_form = UserUpdateForm(request.POST, instance=user)
        
        if user_form.is_valid():
            try:
                with transaction.atomic():
                    # Verificar se email foi alterado
                    email_changed = user_form.cleaned_data['email'] != user.email
                    
                    user_form.save()
                    
                    # Se email foi alterado, enviar alerta de segurança
                    if email_changed:
                        EmailService.send_security_alert(
                            user, 
                            self.get_client_ip(request),
                            request.META.get('HTTP_USER_AGENT', '')
                        )
                    
                    messages.success(request, 'Perfil atualizado com sucesso!')
                    
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return JsonResponse({
                            'success': True,
                            'message': 'Perfil atualizado com sucesso!'
                        })
                    
                    return redirect('auth:profile')
                    
            except Exception as e:
                messages.error(request, 'Erro ao atualizar perfil.')
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False,
                        'message': 'Erro ao atualizar perfil.'
                    })
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                errors = {}
                errors.update(user_form.errors)
                return JsonResponse({
                    'success': False,
                    'errors': errors,
                    'message': 'Corrija os erros no formulário.'
                })
        
        context = {
            'user_form': user_form
        }
        return render(request, self.template_name, context)

class AddressManagementView(LoginRequiredMixin, View):
    """View para gerenciar endereços"""
    template_name = 'modules/authentication/addresses.html'
    login_url = 'auth:login'
    
    def get(self, request):
        addresses = Address.objects.filter(user=request.user).order_by('-is_default', 'created_at')
        form = AddressForm()
        
        context = {
            'addresses': addresses,
            'form': form,
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        action = request.POST.get('action')
        
        if action == 'add':
            return self.add_address(request)
        elif action == 'edit':
            return self.edit_address(request)
        elif action == 'delete':
            return self.delete_address(request)
        elif action == 'set_default':
            return self.set_default_address(request)
        
        return redirect('auth:addresses')
    
    def add_address(self, request):
        form = AddressForm(request.POST)
        
        if form.is_valid():
            address = form.save(commit=False)
            address.user = request.user
            
            # Se é o primeiro endereço, definir como padrão
            if not Address.objects.filter(user=request.user).exists():
                address.is_default = True
            
            # Se marcado como padrão, desmarcar outros
            if address.is_default:
                Address.objects.filter(user=request.user).update(is_default=False)
            
            address.save()
            
            messages.success(request, 'Endereço adicionado com sucesso!')
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': 'Endereço adicionado com sucesso!'
                })
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'errors': form.errors,
                    'message': 'Corrija os erros no formulário.'
                })
        
        return redirect('auth:addresses')
    
    def edit_address(self, request):
        address_id = request.POST.get('address_id')
        address = get_object_or_404(Address, id=address_id, user=request.user)
        
        form = AddressForm(request.POST, instance=address)
        
        if form.is_valid():
            address = form.save(commit=False)
            
            # Se marcado como padrão, desmarcar outros
            if address.is_default:
                Address.objects.filter(user=request.user).exclude(id=address.id).update(is_default=False)
            
            address.save()
            
            messages.success(request, 'Endereço atualizado com sucesso!')
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': 'Endereço atualizado com sucesso!'
                })
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'errors': form.errors,
                    'message': 'Corrija os erros no formulário.'
                })
        
        return redirect('auth:addresses')
    
    def delete_address(self, request):
        address_id = request.POST.get('address_id')
        address = get_object_or_404(Address, id=address_id, user=request.user)
        
        # Se é o endereço padrão, definir outro como padrão
        if address.is_default:
            other_address = Address.objects.filter(
                user=request.user
            ).exclude(id=address.id).first()
            
            if other_address:
                other_address.is_default = True
                other_address.save()
        
        address.delete()
        
        messages.success(request, 'Endereço removido com sucesso!')
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'message': 'Endereço removido com sucesso!'
            })
        
        return redirect('auth:addresses')
    
    def set_default_address(self, request):
        address_id = request.POST.get('address_id')
        
        # Desmarcar todos como padrão
        Address.objects.filter(user=request.user).update(is_default=False)
        
        # Marcar o selecionado como padrão
        address = get_object_or_404(Address, id=address_id, user=request.user)
        address.is_default = True
        address.save()
        
        messages.success(request, 'Endereço padrão atualizado!')
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'message': 'Endereço padrão atualizado!'
            })
        
        return redirect('auth:addresses')
# endregion Profile
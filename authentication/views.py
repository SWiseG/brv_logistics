from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.views.generic import TemplateView, View, CreateView, UpdateView
from django.http import JsonResponse
from django.urls import reverse_lazy, reverse
from django.core.mail import send_mail
from django.conf import settings
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.template.loader import render_to_string
from django.contrib.sites.shortcuts import get_current_site
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
import json

from django.contrib.auth.models import Group
from users.models import Address, User, EmailVerification, UserLoginAttempt
from users.forms import *
from .utils import EmailService

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
            
            # Verificar requisitos de segurança
            requires_verification = UserLoginAttempt.check_security_requirements(email, ip_address)
            
            # Tentar autenticar
            user = authenticate(request, username=email, password=password)
            
            if user is not None:
                if user.is_active:
                    if requires_verification:
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
                        # Login normal
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
                    user_form.save()
                    
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

class PasswordResetRequestView(View):
    """Solicitar redefinição de senha"""
    template_name = 'modules/authentication/password_reset_request.html'
    
    def get(self, request):
        return render(request, self.template_name)
    
    def post(self, request):
        from users.models import User as usuario
        email = request.POST.get('email', '').strip()
        
        if not email:
            messages.error(request, 'E-mail é obrigatório.')
            return render(request, self.template_name)
        
        try:
            user = usuario.objects.get(email__iexact=email, is_active=True)
            
            # Enviar email de redefinição
            self.send_reset_email(request, user)
            
            messages.success(request, 'Email enviado! Verifique sua caixa de entrada.')
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': 'Email de redefinição enviado!'
                })
            
        except usuario.DoesNotExist:
            # Por segurança, não revelar se o email existe
            messages.success(request, 'Se o email existir, você receberá instruções.')
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': 'Instruções enviadas se o email existir.'
                })
        
        return render(request, self.template_name)
    
    def send_reset_email(self, request, user):
        """Enviar email de redefinição de senha"""
        try:
            current_site = get_current_site(request)
            subject = f'Redefinir senha - {current_site.name}'
            
            context = {
                'user': user,
                'domain': current_site.domain,
                'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                'token': default_token_generator.make_token(user),
                'protocol': 'https' if request.is_secure() else 'http',
            }
            
            message = render_to_string('modules/authentication/emails/password_reset.html', context)
            
            send_mail(
                subject=subject,
                message='',
                html_message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Erro ao enviar email: {e}")

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
            'masked_email': self.mask_email(email)
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        email = request.session.get('verification_email')
        verification_type = request.session.get('verification_type', 'registration')
        code = request.POST.get('verification_code', '').strip()
        
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

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.sites.shortcuts import get_current_site
import logging

logger = logging.getLogger(__name__)

class EmailService:
    """Serviço para envio de emails do sistema"""
    
    @staticmethod
    def send_verification_code(email, code, user_name='', verification_type='registration'):
        """Envia código de verificação por email"""
        
        try:
            # Definir assunto e template baseado no tipo
            subjects = {
                'registration': 'Confirme seu cadastro',
                'login_verification': 'Verificação de login',
                'password_reset': 'Redefinição de senha',
                'email_change': 'Alteração de email'
            }
            
            subject = f"{subjects.get(verification_type, 'Verificação')} - {settings.SITE_NAME}"
            
            # Contexto para o template
            context = {
                'code': code,
                'user_name': user_name,
                'verification_type': verification_type,
                'site_name': getattr(settings, 'SITE_NAME', 'Nossa Loja'),
                'site_url': getattr(settings, 'SITE_URL', 'http://localhost:8000'),
                'support_email': getattr(settings, 'SUPPORT_EMAIL', 'suporte@sualoja.com'),
                'expires_minutes': 10
            }
            
            # Renderizar template HTML
            html_message = render_to_string('modules/authentication/emails/verification_code.html', context)
            
            # Renderizar template de texto
            text_message = render_to_string('modules/authentication/emails/verification_code_pt-BR.txt', context)
            
            # Enviar email
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            
            logger.info(f"Email de verificação enviado para {email} - Tipo: {verification_type}")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao enviar email para {email}: {str(e)}")
            return False
    
    @staticmethod
    def send_welcome_email(user):
        """Envia email de boas-vindas após cadastro"""
        
        try:
            subject = f"Bem-vindo à {getattr(settings, 'SITE_NAME', 'Nossa Loja')}!"
            
            context = {
                'user': user,
                'site_name': getattr(settings, 'SITE_NAME', 'Nossa Loja'),
                'site_url': getattr(settings, 'SITE_URL', 'http://localhost:8000'),
                'support_email': getattr(settings, 'SUPPORT_EMAIL', 'suporte@sualoja.com'),
            }
            
            html_message = render_to_string('modules/authentication/emails/welcome.html', context)
            text_message = render_to_string('modules/authentication/emails/welcome.txt', context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Email de boas-vindas enviado para {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao enviar email de boas-vindas para {user.email}: {str(e)}")
            return False
    
    @staticmethod
    def send_security_alert(user, ip_address, user_agent):
        """Envia alerta de segurança por login suspeito"""
        
        try:
            subject = f"Alerta de Segurança - {getattr(settings, 'SITE_NAME', 'Nossa Loja')}"
            
            context = {
                'user': user,
                'ip_address': ip_address,
                'user_agent': user_agent,
                'site_name': getattr(settings, 'SITE_NAME', 'Nossa Loja'),
                'site_url': getattr(settings, 'SITE_URL', 'http://localhost:8000'),
                'support_email': getattr(settings, 'SUPPORT_EMAIL', 'suporte@sualoja.com'),
            }
            
            html_message = render_to_string('modules/authentication/emails/security_alert.html', context)
            text_message = render_to_string('modules/authentication/emails/security_alert.txt', context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Alerta de segurança enviado para {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao enviar alerta de segurança para {user.email}: {str(e)}")
            return False

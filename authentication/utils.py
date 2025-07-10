from datetime import timezone
from django.core.mail import send_mail
from django.template import TemplateDoesNotExist
from ecommerce_template import settings
from django.template.loader import get_template
import logging

logger = logging.getLogger(__name__)

class EmailService:
    """Serviço para envio de emails do sistema"""
        
    @staticmethod
    def get_email_template(name, extension='txt', context=None):
        """
        Tenta localizar o template de e-mail seguindo a ordem de prioridade:
        1. name_site_lang.ext
        2. name_lang.ext
        3. name.ext

        Se `context` for passado, retorna o conteúdo renderizado.
        Caso contrário, retorna o caminho do template encontrado.
        """
        from core.models import SiteSettings

        site = settings.config_service('site_name', 'BRVLogistics')
        site_lang = SiteSettings.objects.filter(is_active=True).first().active_lang.first().display or 'pt-BR'

        # Lista de caminhos de fallback
        template_paths = [
            f'modules/authentication/emails/{name}_{site}_{site_lang}.{extension}',
            f'modules/authentication/emails/{name}_{site_lang}.{extension}',
            f'modules/authentication/emails/{name}.{extension}',
        ]

        for template_path in template_paths:
            try:
                template = get_template(template_path)
                if context is not None:
                    return template.render(context)
                return template_path
            except TemplateDoesNotExist:
                continue

        # Lançar erro se nenhum template foi encontrado
        raise TemplateDoesNotExist(
            f"Nenhum template encontrado para '{name}' nas versões com site e linguagem."
        )

    @classmethod
    def send_password_changed_notification(self, user, ip_address):
        """Envia notificação quando senha é alterada"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            subject = f"Senha Alterada - {site_name}"
            
            context = {
                'user': user,
                'changed_at': timezone.now(),
                'ip_address': ip_address,
                'site_name': site_name,
                'site_url': site_url,
                'support_email': site_contact_email,
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('password_changed','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('password_changed','txt',context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Notificação de senha alterada enviada para {user.email}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar notificação de senha alterada: {str(e)}")
            return False
            
    @classmethod
    def send_verification_code(self, email, code, user_name='', verification_type='registration'):
        """Envia código de verificação por email"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            
            # Definir assunto e template baseado no tipo
            subjects = {
                'registration': 'Confirme seu cadastro',
                'login_verification': 'Verificação de login',
                'password_reset': 'Redefinição de senha',
                'email_change': 'Alteração de email'
            }
            
            subject = f"{subjects.get(verification_type, 'Verificação')} - {site_name}"
            
            # Contexto para o template
            context = {
                'code': code,
                'user_name': user_name,
                'verification_type': verification_type,
                'site_name': site_name,
                'site_url': site_url,
                'support_email': site_contact_email,
                'expires_minutes': 10
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('verification_code','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('verification_code','txt',context)
            
            # Enviar email
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[email],
                fail_silently=False,
            )
            
            logger.info(f"Email de verificação enviado para {email} - Tipo: {verification_type}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar email para {email}: {str(e)}")
            return False
    
    @classmethod
    def send_welcome_email(self, user):
        """Envia email de boas-vindas após cadastro"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            
            subject = f"Bem-vindo à {site_name}!"
            
            context = {
                'user': user,
                'site_name': site_name,
                'site_url': site_url,
                'support_email': site_contact_email,
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('welcome','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('welcome','txt',context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Email de boas-vindas enviado para {user.email}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar email de boas-vindas para {user.email}: {str(e)}")
            return False
        
    @classmethod
    def send_new_login_notification(self, user, ip_address, user_agent):
        """Envia notificação de novo login (não suspeito, apenas informativo)"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            
            subject = f"Novo login detectado - {site_name}"
            
            context = {
                'user': user,
                'ip_address': ip_address,
                'user_agent': user_agent,
                'site_url': site_url,
                'login_time': timezone.now(),
                'site_name': site_name,
                'support_email': site_contact_email,
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('new_login_notification','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('new_login_notification','txt',context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Notificação de novo login enviada para {user.email}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar notificação de novo login para {user.email}: {str(e)}")
            return False
    
    @classmethod
    def send_security_alert(self, user, ip_address, user_agent):
        """Envia alerta de segurança por login suspeito"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            
            subject = f"Alerta de Segurança - {site_name}"
            
            context = {
                'user': user,
                'ip_address': ip_address,
                'site_url': site_url,
                'user_agent': user_agent,
                'site_name': site_name,
                'support_email': site_contact_email,
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('security_alert','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('security_alert','txt',context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Alerta de segurança enviado para {user.email}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar alerta de segurança para {user.email}: {str(e)}")
            return False
    
    @classmethod
    def send_account_locked_email(self, user, failed_attempts, unlock_time):
        """Envia email quando conta é bloqueada"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            subject = f"Conta Temporariamente Bloqueada - {site_name}"
            
            unlock_minutes = int((unlock_time - timezone.now()).total_seconds() / 60)
            
            context = {
                'user': user,
                'failed_attempts': failed_attempts,
                'blocked_at': timezone.now(),
                'unlock_time': unlock_time,
                'unlock_minutes': unlock_minutes,
                'site_name': site_name,
                'site_url': site_url,
                'support_email': site_contact_email,
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('account_locked','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('account_locked','txt',context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Email de conta bloqueada enviado para {user.email}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar email de conta bloqueada: {str(e)}")
            return False

    @classmethod
    def send_suspicious_activity_email(self, user, activity_description, ip_address, location=None, user_agent=''):
        """Envia email para atividade altamente suspeita"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            subject = f"🚨 ALERTA CRÍTICO - Atividade Suspeita - {site_name}"
            
            context = {
                'user': user,
                'activity_description': activity_description,
                'detected_at': timezone.now(),
                'ip_address': ip_address,
                'location': location,
                'user_agent': user_agent,
                'site_name': site_name,
                'site_url': site_url,
                'support_email': site_contact_email,
                'support_whatsapp': getattr(settings, 'SUPPORT_WHATSAPP', None),
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('suspicious_activity','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('suspicious_activity','txt',context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.critical(f"Alerta de atividade suspeita enviado para {user.email}: {activity_description}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar alerta de atividade suspeita: {str(e)}")
            return False

    @classmethod
    def send_account_activated_email(self, user):
        """Envia email quando conta é ativada (manual ou automática)"""
        
        try:
            site_name = settings.config_service('site_name', '')
            site_url = settings.config_service('site_url', '')
            site_contact_email = settings.config_service('contact_email')
            site_corp_email = settings.config_service('corp_email')
            subject = f"Conta Ativada - {site_name}"
            
            context = {
                'user': user,
                'site_name': site_name,
                'site_url': site_url,
                'support_email': site_contact_email,
            }
            
            # Renderizar template HTML
            html_message = self.get_email_template('account_activated','html',context)
            
            # Renderizar template de texto
            text_message = self.get_email_template('account_activated','txt',context)
            
            result = send_mail(
                subject=subject,
                message=text_message,
                html_message=html_message,
                from_email=site_corp_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"Email de conta ativada enviado para {user.email}")
            return result or True
            
        except Exception as e:
            logger.error(f"Erro ao enviar email de conta ativada: {str(e)}")
            return False


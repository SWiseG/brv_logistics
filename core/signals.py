from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import SiteSettings
from .services.config_service import ConfigService

SITE_SETTINGS_KEYS = ['contact_email', 'corp_email', 'corp_email_token', 'site_name']
@receiver(post_save, sender=SiteSettings)
def config_updated(sender, instance, **kwargs):
    ConfigService.reload(SITE_SETTINGS_KEYS)

@receiver(post_delete, sender=SiteSettings)
def config_deleted(sender, instance, **kwargs):
    ConfigService.reload(SITE_SETTINGS_KEYS)

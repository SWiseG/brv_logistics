from django.db import models
from django.conf import settings
from theme.models import Theme

class SiteSettings(models.Model):
    site_name = models.CharField(max_length=100, default='E-commerce Template')
    site_description = models.TextField(blank=True, null=True)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=False)
    
    # Redes sociais
    facebook_url = models.URLField(blank=True, null=True)
    instagram_url = models.URLField(blank=True, null=True)
    twitter_url = models.URLField(blank=True, null=True)
    youtube_url = models.URLField(blank=True, null=True)
    
    # SEO
    meta_title = models.CharField(max_length=100, blank=True, null=True)
    meta_description = models.TextField(blank=True, null=True)
    meta_keywords = models.CharField(max_length=255, blank=True, null=True)
    
    # Configurações de negócio
    currency = models.CharField(max_length=3, default='BRL')
    enable_tax = models.BooleanField(default=True)
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Tema ativo
    active_theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        verbose_name_plural = 'Site Settings'
    
    def __str__(self):
        return self.site_name
    
    def save(self, *args, **kwargs):
        if self.is_active:
            # Garante que apenas um sistema esteja ativo
            SiteSettings.objects.filter(is_active=True).update(is_active=False)
        super().save(*args, **kwargs)
    
    @classmethod
    def get_settings(cls):
        """
        Retorna as configurações do site ou cria uma instância padrão
        """
        settings, created = cls.objects.get_or_create(pk=1)
        return settings


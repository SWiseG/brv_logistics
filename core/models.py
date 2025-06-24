from django.db import models
from django.conf import settings
from django.forms import ValidationError
from models.base import BaseModel
from theme.models import Theme

class SiteSettings(BaseModel):
    site_name = models.CharField(max_length=100, default='BRV Logistics')
    site_description = models.TextField(blank=True, null=True)
    contact_email = models.EmailField()
    corp_email_token = models.CharField(max_length=100, blank=True, null=True)
    corp_email = models.EmailField(blank=True, null=True)
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
    @property
    def active_theme(self):
        from django.db.models import Q
        return self.themes.filter(Q(is_active=True) | Q(is_default=True))
    
    # Tema ativo
    @property
    def active_lang(self):
        from django.db.models import Q
        return self.langs.filter(Q(is_active=True))
    
    @property
    def hero_sections(self):
        from django.utils import timezone
        today = timezone.now().date()
        return self.hero_section.filter(expires_at__gt=today).order_by('order')[:5]
    
    class Meta:
        verbose_name_plural = 'Site Configurações'
    
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

class HeroSectionSettings(BaseModel):
    site = models.ForeignKey(SiteSettings, on_delete=models.CASCADE, related_name='hero_section')
    title = models.CharField(max_length=250, blank=True, null=True)
    sub_title = models.TextField(blank=True, null=True)
    action_text = models.CharField(max_length=50,blank=True, null=True)
    action_callback = models.CharField(max_length=50,blank=True, null=True)
    order = models.IntegerField()
    image = models.ImageField(upload_to='themes/images/hero/') 
    expires_at = models.DateTimeField(verbose_name='Expira em')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
     
    class Meta:
        verbose_name_plural = 'Anúncios Página Principal'
        

class Languages(BaseModel):
    site = models.ForeignKey('core.SiteSettings', on_delete=models.CASCADE, related_name='langs')
    name = models.CharField(max_length=250, default="Português - Brasil")
    display = models.CharField(max_length=250, default="pt-BR")
    is_active = models.BooleanField(default=True)
    class Meta:
        verbose_name_plural = 'Idiomas'

    def clean(self):
        if self.is_active:
            active_lang = Languages.objects.filter(site=self.site, is_active=True).exclude(id=self.id)
            if active_lang.exists():
                Languages.objects.filter(site=self.site, is_active=True).exclude(id=self.id).update(is_active=False)

    def save(self, *args, **kwargs):
        self.clean()  # Executa a validação antes de salvar
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} | Site: {self.site.site_name} | Active: {self.is_active}"
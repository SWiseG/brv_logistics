from django.contrib import admin
from .models import SiteSettings

# Configuração do admin para core
@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ['site_name', 'contact_email']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('site_name', 'site_description', 'is_active')
        }),
        ('Contato', {
            'fields': ('contact_email', 'contact_phone', 'address')
        }),
        ('Redes Sociais', {
            'fields': ('facebook_url', 'instagram_url', 'twitter_url', 'youtube_url')
        }),
        ('SEO', {
            'fields': ('meta_title', 'meta_description', 'meta_keywords')
        }),
        ('Configurações de Negócio', {
            'fields': ('currency', 'enable_tax', 'tax_percentage')
        }),
        ('Tema', {
            'fields': ('active_theme',)
        }),
    )


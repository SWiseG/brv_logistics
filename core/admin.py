from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Custom Admin Site
admin.site.site_header = "BRV Logistics Admin"
admin.site.site_title = "BRV Logistics Admin"
admin.site.index_title = "Painel Administrativo"

@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ['site_name', 'contact_email', 'is_active']
    list_editable = ['is_active']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('site_name', 'site_description', 'is_active')
        }),
        ('Contato', {
            'fields': ('contact_email', 'contact_phone', 'address', 'corp_email', 'corp_email_token')
        }),
        ('Redes Sociais', {
            'fields': ('facebook_url', 'instagram_url', 'twitter_url', 'youtube_url')
        }),
        ('SEO', {
            'fields': ('meta_title', 'meta_description', 'meta_keywords')
        }),
        ('Configurações de Negócio', {
            'fields': ('currency', 'enable_tax', 'tax_percentage')
        })
    )
    
@admin.register(HeroSectionSettings)
class HeroSectionSettingsAdmin(admin.ModelAdmin):
    list_display = ['title', 'sub_title']
    
    fieldsets = (
        ('Informações do Anúncio', {
            'fields': ('title', 'sub_title', 'image', 'action_text', 'action_callback')
        }),
        ('Expiração', {
            'fields': ('expires_at',)
        }),
        ('Ordem', {
            'fields': ('order',)
        }),
        ('Site', {
            'fields': ('site',)
        })
    )
    
@admin.register(Languages)
class LanguagesAdmin(admin.ModelAdmin):
    list_display = ['site', 'name', 'display', 'is_active']
    
    fieldsets = (
        ('Informações do Anúncio', {
            'fields': ('name', 'display')
        }),
        ('Ativo', {
            'fields': ('is_active',)
        }),
        ('Vínculo de Site', {
            'fields': ('site',)
        })
    )
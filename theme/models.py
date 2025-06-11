from django.db import models
from django.conf import settings
from colorfield.fields import ColorField

class Theme(models.Model):
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    
    # Cores padrão
    off_white = ColorField(default='#fafafa')
    white = ColorField(default='#fcfcfc')
    black = ColorField(default='#1b1b1b')
    
    # Cores principais
    primary_color = ColorField(default='#007bff')
    secondary_color = ColorField(default='#6c757d')
    
    # Cores de feedback
    fb_info_color = ColorField(default='#336899')
    fb_danger_color = ColorField(default='#994233')
    fb_warning_color = ColorField(default='#ccbb00')
    fb_success_color = ColorField(default='#339938')
    
    # Cores neutras
    neutral_color = ColorField(default='#7c7c7c')
    shadow_color = ColorField(default='#0000001a')
    
    # Fontes
    heading_font = models.CharField(max_length=100, default='Roboto')
    body_font = models.CharField(max_length=100, default='Roboto')
    
    # Logos
    logo = models.ImageField(upload_to='themes/logos/', blank=True, null=True)
    favicon = models.ImageField(upload_to='themes/favicons/', blank=True, null=True)
    
    # CSS personalizado
    custom_css = models.TextField(blank=True, null=True)
    custom_js = models.TextField(blank=True, null=True)
    
    # Configurações de layout
    show_featured_products = models.BooleanField(default=True)
    show_categories_menu = models.BooleanField(default=True)
    products_per_page = models.PositiveIntegerField(default=10)
    
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if self.is_default:
            # Garante que apenas um tema seja o padrão
            Theme.objects.filter(is_default=True).update(is_default=False)
        if self.is_active:
            # Garante que apenas um tema esteja ativo
            Theme.objects.filter(is_active=True).update(is_active=False)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name


from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Configuração do admin para temas
@admin.register(Theme)
class ThemeAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'is_default', 'date_created']
    list_filter = ['is_active', 'is_default', 'date_created']
    search_fields = ['name']
    list_editable = ['is_active', 'is_default']


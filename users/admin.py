from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Configuração básica do admin para usuários
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'first_name', 'last_name', 'is_active', 'date_joined']
    list_filter = ['is_active', 'is_staff', 'date_joined']
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    ordering = ['-date_joined']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Informações Pessoais', {'fields': ('first_name', 'last_name', 'phone')}),
        ('Permissões', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Datas Importantes', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['user', 'street', 'city', 'state', 'postal_code', 'is_default']
    
@admin.register(GroupType)
class GroupTypeAdmin(admin.ModelAdmin):
    list_display = ['group', 'is_adm', 'is_dev']
    
@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = ['user', 'type', 'value']
    
    fieldsets = (
        (None, {'fields': ('user', 'type', 'value',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('user', 'type', 'value',),
        }),
    )

@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    pass

@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    pass
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Address, GroupType

# Configuração básica do admin para usuários
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_staff']

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['user', 'street', 'city', 'state', 'postal_code', 'is_default']
    
@admin.register(GroupType)
class GroupTypeAdmin(admin.ModelAdmin):
    list_display = ['group', 'is_adm', 'is_dev']
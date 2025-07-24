from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = [
        'code', 'discount_type', 'discount_value', 
        'used_count', 'usage_limit', 'is_active', 'valid_from'
    ]
    list_filter = ['discount_type', 'is_active', 'valid_from']
    search_fields = ['code', 'name']
    readonly_fields = ['used_count', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('code', 'description')
        }),
        ('Desconto', {
            'fields': ('discount_type', 'discount_value', 'maximum_discount')
        }),
        ('Limites', {
            'fields': ('minimum_amount', 'usage_limit', 'usage_limit_per_user', 'used_count')
        }),
        ('Restrições', {
            'fields': ('applicable_to', 'restrictions')
        }),
        ('Status e Datas', {
            'fields': ('is_active', 'starts_at', 'valid_from')
        }),
        ('Datas do Sistema', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
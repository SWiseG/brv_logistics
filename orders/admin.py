from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Order Management
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['product_name', 'product_sku', 'total_price']

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    inlines = [OrderItemInline]
    list_display = [
        'order_number', 'user', 'status', 'total_amount', 
        'created_at', 'confirmed_at'
    ]
    list_filter = ['status', 'created_at', 'confirmed_at']
    search_fields = ['order_number', 'user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['uuid', 'order_number', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Informações do Pedido', {
            'fields': ('uuid', 'order_number', 'user', 'status')
        }),
        ('Endereços', {
            'fields': ('billing_address', 'shipping_address')
        }),
        ('Valores', {
            'fields': ('currency', 'subtotal', 'tax_amount', 'shipping_amount', 'discount_amount', 'total_amount')
        }),
        ('Observações', {
            'fields': ('notes', 'internal_notes')
        }),
        ('Datas', {
            'fields': ('created_at', 'updated_at', 'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at'),
            'classes': ('collapse',)
        })
    )
    
    actions = ['mark_as_confirmed', 'mark_as_shipped']
    
    def mark_as_confirmed(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(status='pending').update(
            status='confirmed',
            confirmed_at=timezone.now()
        )
        self.message_user(request, f'{updated} pedidos confirmados.')
    mark_as_confirmed.short_description = 'Confirmar pedidos selecionados'
    
    def mark_as_shipped(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(status='confirmed').update(
            status='shipped',
            shipped_at=timezone.now()
        )
        self.message_user(request, f'{updated} pedidos marcados como enviados.')
    mark_as_shipped.short_description = 'Marcar como enviado'
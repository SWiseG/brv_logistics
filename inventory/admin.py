from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Inventory Management
@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'city', 'country', 'is_active', 'is_default']
    list_filter = ['is_active', 'is_default', 'country']
    search_fields = ['name', 'code', 'city']

@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = [
        'product', 'warehouse', 'quantity_available', 
        'quantity_reserved', 'reorder_point', 'last_cost'
    ]
    list_filter = ['warehouse', 'product__category']
    search_fields = ['product__name', 'product__sku', 'warehouse__name']
    readonly_fields = ['created_at', 'updated_at']

from django.contrib import admin
from .models import Cart, CartItem, Order, OrderItem, Coupon

# Configuração do admin para pedidos
@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ['user', 'session_id', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['user__username', 'session_id']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ['cart', 'product', 'quantity', 'price']
    list_filter = ['cart__created_at']
    search_fields = ['product__name', 'cart__user__username']

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'user', 'status', 'total', 'date_created']
    list_filter = ['status', 'payment_method', 'date_created']
    search_fields = ['order_number', 'user__username', 'user__email']
    readonly_fields = ['order_number', 'date_created', 'date_updated']
    list_editable = ['status']

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'product', 'quantity', 'price', 'subtotal']
    list_filter = ['order__date_created']
    search_fields = ['product__name', 'order__order_number']

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_type', 'discount_value', 'is_active', 'valid_from', 'valid_to']
    list_filter = ['discount_type', 'is_active', 'valid_from', 'valid_to']
    search_fields = ['code', 'description']
    list_editable = ['is_active']


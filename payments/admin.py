from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'order', 'payment_method', 'amount', 'status', 
        'processed_at', 'created_at'
    ]
    list_filter = ['status', 'payment_method', 'created_at', 'processed_at']
    search_fields = ['order__order_number', 'external_id', 'reference']
    readonly_fields = ['uuid', 'created_at', 'updated_at']


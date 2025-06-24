from django.contrib import admin

from orders.models import Order, User
from products.models import Product
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Dashboard customizations
def get_admin_stats():
    """Get admin dashboard statistics"""
    from django.db.models import Count, Sum
    from django.utils import timezone
    from datetime import timedelta
    
    today = timezone.now().date()
    last_30_days = today - timedelta(days=30)
    
    stats = {
        'total_users': User.objects.count(),
        'total_products': Product.objects.filter(is_active=True).count(),
        'total_orders': Order.objects.count(),
        'orders_today': Order.objects.filter(created_at__date=today).count(),
        'orders_last_30_days': Order.objects.filter(created_at__date__gte=last_30_days).count(),
        'revenue_last_30_days': Order.objects.filter(
            created_at__date__gte=last_30_days,
            status='delivered'
        ).aggregate(total=Sum('total_amount'))['total'] or 0,
        'pending_orders': Order.objects.filter(status='pending').count(),
    }
    
    return stats
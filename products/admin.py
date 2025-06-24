from django.contrib import admin
from .models import *

from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Product Management
class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ['image', 'alt_text', 'is_primary', 'sort_order']
    
    def get_queryset(self, request):
        return super().get_queryset(request).order_by('sort_order')

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = ['sku', 'attributes', 'price', 'cost_price', 'weight', 'is_active']

class ProductAttributeValueInline(admin.TabularInline):
    model = ProductAttributeValue
    extra = 0

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'is_active', 'sort_order', 'product_count']
    list_filter = ['is_active', 'parent']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    ordering = ['sort_order', 'name']
    
    def product_count(self, obj):
        return obj.products.count()
    product_count.short_description = 'Produtos'

@admin.register(ProductBrand)
class ProductBrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'product_count']
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    
    def product_count(self, obj):
        return obj.products.count()
    product_count.short_description = 'Produtos'

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    inlines = [ProductImageInline, ProductVariantInline, ProductAttributeValueInline]
    list_display = [
        'name', 'sku', 'category', 'brand', 'price', 'is_active', 
        'is_featured', 'stock_status', 'created_at'
    ]
    list_filter = [
        'is_active', 'is_featured', 'is_digital', 'category', 'brand', 'created_at'
    ]
    search_fields = ['name', 'sku', 'description']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['uuid', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('uuid', 'name', 'slug', 'sku', 'ean')
        }),
        ('Categorização', {
            'fields': ('category', 'brand', 'supplier')
        }),
        ('Descrição', {
            'fields': ('short_description', 'description', 'specifications')
        }),
        ('Preços', {
            'fields': ('cost_price', 'price', 'compare_at_price')
        }),
        ('Físico', {
            'fields': ('weight', 'length', 'width', 'height')
        }),
        ('Status e Configurações', {
            'fields': (
                'is_active', 'is_featured', 'is_digital', 
                'requires_shipping', 'track_inventory', 'allow_backorder'
            )
        }),
        ('SEO', {
            'fields': ('meta_title', 'meta_description', 'meta_keywords'),
            'classes': ('collapse',)
        }),
        ('Datas', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def stock_status(self, obj):
        if not obj.track_inventory:
            return format_html('Não rastreado')
        
        total_stock = sum([
            item.quantity_available for item in obj.inventory_items.all()
        ])
        
        if total_stock > 0:
            return format_html('{} unidades', total_stock)
        else:
            return format_html('Sem estoque')
    
    stock_status.short_description = 'Estoque'

@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ['product', 'user', 'rating', 'is_approved', 'is_verified_purchase', 'created_at']
    list_filter = ['rating', 'is_approved', 'is_verified_purchase', 'created_at']
    search_fields = ['product__name', 'user__email', 'title', 'review']
    readonly_fields = ['helpful_count', 'created_at', 'updated_at']
    actions = ['approve_reviews', 'disapprove_reviews']
    
    def approve_reviews(self, request, queryset):
        updated = queryset.update(is_approved=True)
        self.message_user(request, f'{updated} avaliações aprovadas.')
    approve_reviews.short_description = 'Aprovar avaliações selecionadas'
    
    def disapprove_reviews(self, request, queryset):
        updated = queryset.update(is_approved=False)
        self.message_user(request, f'{updated} avaliações desaprovadas.')
    disapprove_reviews.short_description = 'Desaprovar avaliações selecionadas'
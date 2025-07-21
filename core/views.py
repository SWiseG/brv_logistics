from django.shortcuts import render
from django.views.generic import TemplateView, View
from django.db.models import Q, Count, Avg
from django.http import JsonResponse

import os
from django.conf import settings
from django.core.cache import cache

from django.utils import timezone
from datetime import timedelta

from products.models import Product, ProductCategory, ProductBrand
from orders.models import OrderItem

class HomeView(TemplateView):
    template_name = 'modules/core/home.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        from core.models import SiteSettings
        sys_config = SiteSettings.objects.get(is_active=True)
        
        # Anúnicos em destaque
        context['hero_sections'] = list(sys_config.hero_sections) if sys_config else []
        print(list(sys_config.hero_sections))
        
        # Produtos em destaque
        context['featured_products'] = Product.objects.filter(
            is_active=True, 
            is_featured=True
        ).select_related('category', 'brand')[:8]
        
        # Produtos mais vendidos (baseado em pedidos)
        context['popular_products'] = Product.objects.filter(
            is_active=True
        ).select_related('category', 'brand')[:8]
        
        # Categorias principais
        context['main_categories'] = ProductCategory.objects.filter(
            is_active=True, 
            parent_id__isnull=True
        )[:6]
        
        # Ofertas especiais (produtos com desconto)
        context['special_offers'] = Product.objects.filter(
            is_active=True,
            compare_at_price__gt=0
        ).select_related('category', 'brand')[:4]
        
        # Novos produtos (últimos 30 dias)
        from datetime import datetime, timedelta
        thirty_days_ago = datetime.now() - timedelta(days=30)
        context['new_products'] = Product.objects.filter(
            is_active=True,
            created_at__gte=thirty_days_ago
        ).select_related('category', 'brand')[:8]
        
        context['title'] = 'Home'
        
        return context
        
class ContactView(TemplateView):
    template_name = 'modules/core/contact.html'

class AboutView(TemplateView):
    template_name = 'modules/core/about.html'

class SearchSuggestionsView(View):
    """View para sugestões de busca em tempo real"""
    
    def get(self, request):
        query = request.GET.get('q', '').strip()
        
        if len(query) < 2:
            return JsonResponse({'suggestions': []})
        
        # Buscar produtos
        products = Product.objects.filter(
            Q(name__icontains=query) | 
            Q(short_description__icontains=query) |
            Q(sku__icontains=query),
            is_active=True
        ).select_related('category', 'brand').prefetch_related('images')[:5]
        
        # Buscar categorias
        categories = ProductCategory.objects.filter(
            name__icontains=query,
            is_active=True
        ).annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        )[:5]
        
        suggestions = []
        
        # Adicionar produtos às sugestões
        for product in products:
            suggestions.append({
                'type': 'product',
                'id': product.id,
                'name': product.name,
                'url': product.get_absolute_url(),
                'image': product.get_primary_image(),
                'price': float(product.price),
                'formatted_price': f'R$ {product.price:.2f}',
                'category': product.category.name if product.category else '',
                'brand': product.brand.name if product.brand else '',
            })
        
        # Adicionar categorias às sugestões
        for category in categories:
            suggestions.append({
                'type': 'category',
                'id': category.id,
                'name': category.name,
                'url': category.get_absolute_url(),
                'product_count': category.product_count,
            })
        
        return JsonResponse({
            'suggestions': suggestions,
            'query': query
        })
          
import os
from django.conf import settings
from django.http import JsonResponse

def static_modals(request):
    base_path = os.path.join(settings.BASE_DIR, 'static', 'modals')
    resultado = []

    if os.path.exists(base_path):
        for folder_name in os.listdir(base_path):
            folder_path = os.path.join(base_path, folder_name)

            if os.path.isdir(folder_path):
                base_name = folder_name.lower().replace(' ', '.')

                views_path = os.path.join(folder_path, 'views')
                scripts_path = os.path.join(folder_path, 'scripts')

                # -------- Views --------
                views_main = None

                if os.path.exists(views_path):
                    for f in os.listdir(views_path):
                        if os.path.isfile(os.path.join(views_path, f)) and f.endswith('.html'):
                            relative_path = f'modals/{folder_name}/views/{f}'
                            if f.lower() == f'{base_name}.html':
                                views_main = relative_path

                # -------- Scripts --------
                scripts_main = None

                if os.path.exists(scripts_path):
                    for f in os.listdir(scripts_path):
                        if os.path.isfile(os.path.join(scripts_path, f)) and f.endswith('.js'):
                            relative_path = f'modals/{folder_name}/scripts/{f}'
                            if f.lower() == f'{base_name}.js':
                                scripts_main = relative_path

                resultado.append({
                    'name': folder_name,
                    'views': views_main,
                    'scripts': scripts_main
                })

    return JsonResponse(resultado, safe=False)

# View para limpar cache (apenas para desenvolvimento)
class ClearCacheView(View):
    """View para limpar cache - apenas para desenvolvimento"""
    
    def get(self, request):
        if not request.user.is_superuser:
            return JsonResponse({'error': 'Acesso negado'}, status=403)
        
        cache_keys = [
            'site_settings',
            'hero_sections',
            'main_categories_with_count',
            'featured_products',
            'popular_products',
            'special_offers',
            'new_products',
            'featured_brands',
            'site_statistics',
            'promotional_banners'
        ]
        
        for key in cache_keys:
            cache.delete(key)
        
        return JsonResponse({'message': 'Cache limpo com sucesso'})
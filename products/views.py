from django.shortcuts import render, get_object_or_404
from django.views.generic import ListView, DetailView
from django.db.models import Q, F
from .models import Product, ProductCategory

class ProductSearchView(ListView):
    model = Product
    template_name = 'modules/products/search.html'
    context_object_name = 'products'
    paginate_by = 20
    
    def get_queryset(self):
        query = self.request.GET.get('q', '')
        if query:
            return Product.objects.filter(
                Q(name__icontains=query) | 
                Q(description__icontains=query) |
                Q(sku__icontains=query),
                is_active=True
            ).select_related('category', 'brand')
        return Product.objects.none()
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['query'] = self.request.GET.get('q', '')
        return context

class CategoryView(ListView):
    model = Product
    template_name = 'modules/products/category.html'
    context_object_name = 'products'
    paginate_by = 20
    
    def get_queryset(self):
        self.category = get_object_or_404(ProductCategory, slug=self.kwargs['slug'])
        return Product.objects.filter(
            category=self.category,
            is_active=True
        ).select_related('category', 'brand')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['category'] = self.category
        return context

class ProductDetailView(DetailView):
    model = Product
    template_name = 'modules/products/detail.html'
    context_object_name = 'product'
    
    def get_queryset(self):
        return Product.objects.filter(is_active=True).select_related('category', 'brand')

class OffersView(ListView):
    model = Product
    template_name = 'modules/products/offers.html'
    context_object_name = 'products'
    paginate_by = 20
    
    def get_queryset(self):
        return Product.objects.filter(
            Q(compare_at_price__gt=0) & Q(compare_at_price__gt=F('price')),
            is_active=True,
        ).select_related('category', 'brand')

class ProductListView(ListView):
    model = Product
    template_name = 'modules/products/list.html'
    context_object_name = 'products'
    paginate_by = 20
    
    def get_queryset(self):
        return Product.objects.filter(is_active=True).select_related('category', 'brand')
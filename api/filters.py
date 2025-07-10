import django_filters
from django.db.models import Q
from products.models import Product, ProductCategory, ProductBrand

class ProductFilter(django_filters.FilterSet):
    """Advanced product filtering"""
    
    # Price filtering
    price_min = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    price_max = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    price_range = django_filters.RangeFilter(field_name='price')
    
    # Category filtering
    category = django_filters.ModelChoiceFilter(
        field_name='category',
        queryset=ProductCategory.objects.filter(is_active=True)
    )
    category_slug = django_filters.CharFilter(field_name='category__slug')
    
    # Brand filtering
    brand = django_filters.ModelChoiceFilter(
        field_name='brand',
        queryset=ProductBrand.objects.filter(is_active=True)
    )
    brand_slug = django_filters.CharFilter(field_name='brand__slug')
    
    # Availability filtering
    in_stock = django_filters.BooleanFilter(method='filter_in_stock')
    featured = django_filters.BooleanFilter(field_name='is_featured')
    
    # Search
    search = django_filters.CharFilter(method='filter_search')
    
    # Attributes filtering (JSONB)
    attributes = django_filters.CharFilter(method='filter_attributes')
    
    class Meta:
        model = Product
        fields = [
            'category', 'brand', 'is_featured', 'is_digital',
            'price_min', 'price_max', 'in_stock'
        ]
    
    def filter_in_stock(self, queryset, name, value):
        """Filter products in stock"""
        if value:
            return queryset.filter(
                Q(track_inventory=False) |
                Q(inventory_items__quantity_available__gt=0)
            ).distinct()
        return queryset
    
    def filter_search(self, queryset, name, value):
        """Global search filter"""
        return queryset.filter(
            Q(name__icontains=value) |
            Q(description__icontains=value) |
            Q(sku__icontains=value) |
            Q(brand__name__icontains=value) |
            Q(category__name__icontains=value)
        ).distinct()
    
    def filter_attributes(self, queryset, name, value):
        """Filter by product attributes"""
        # Expected format: "color:red,size:large"
        if not value:
            return queryset
        
        filters = Q()
        for attr_filter in value.split(','):
            if ':' in attr_filter:
                attr_name, attr_value = attr_filter.split(':', 1)
                filters &= Q(
                    attributes__attribute__slug=attr_name.strip(),
                    attributes__value__icontains=attr_value.strip()
                )
        
        return queryset.filter(filters).distinct()
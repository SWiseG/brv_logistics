from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Avg, Count
from django.utils import timezone
from decimal import Decimal

from analytics.models import *
from core.models import *
from inventory.models import *
from marketing.models import *
from orders.models import *
from payments.models import *
from products.models import *
from shipping.models import *
from suppliers.models import *
from theme.models import *
from users.models import *

from .serializers import *
from .filters import ProductFilter
from .permissions import IsOwnerOrReadOnly

class ProductCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Product categories API"""
    
    queryset = ProductCategory.objects.filter(is_active=True)
    serializer_class = ProductCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name', 'description']
    filterset_fields = ['parent']
    
    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):
        """Get products in category"""
        category = self.get_object()
        products = Product.objects.filter(
            category=category,
            is_active=True
        ).select_related('brand', 'category').prefetch_related('images')
        
        page = self.paginate_queryset(products)
        if page is not None:
            serializer = ProductSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response(serializer.data)

class ProductBrandViewSet(viewsets.ReadOnlyModelViewSet):
    """Product brands API"""
    
    queryset = ProductBrand.objects.filter(is_active=True)
    serializer_class = ProductBrandSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Products API with advanced filtering"""
    
    queryset = Product.objects.filter(is_active=True).select_related(
        'category', 'brand'
    ).prefetch_related('images', 'variants', 'attributes', 'reviews')
    
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ['name', 'description', 'sku']
    ordering_fields = ['name', 'price', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Custom queryset with annotations"""
        queryset = super().get_queryset()
        
        # Add annotations for sorting
        queryset = queryset.annotate(
            avg_rating=Avg('reviews__rating'),
            review_count=Count('reviews')
        )
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def reviews(self, request, pk=None):
        """Get product reviews"""
        product = self.get_object()
        reviews = product.reviews.filter(is_approved=True).select_related('user')
        
        page = self.paginate_queryset(reviews)
        if page is not None:
            from .serializers import ProductReviewSerializer
            serializer = ProductReviewSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        from .serializers import ProductReviewSerializer
        serializer = ProductReviewSerializer(reviews, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_review(self, request, pk=None):
        """Add product review"""
        product = self.get_object()
        
        # Check if user already reviewed this product
        if product.reviews.filter(user=request.user).exists():
            return Response({
                'error': 'Você já avaliou este produto.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from .serializers import ProductReviewSerializer
        serializer = ProductReviewSerializer(
            data=request.data, 
            context={'request': request}
        )
        
        if serializer.is_valid():
            serializer.save(product=product)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured products"""
        products = self.get_queryset().filter(is_featured=True)[:12]
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Advanced product search"""
        query = request.query_params.get('q', '')
        
        if not query:
            return Response({'results': []})
        
        products = self.get_queryset().filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(sku__icontains=query) |
            Q(brand__name__icontains=query) |
            Q(category__name__icontains=query)
        ).distinct()
        
        page = self.paginate_queryset(products)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

class CartViewSet(viewsets.ModelViewSet):
    """Shopping cart API"""
    
    serializer_class = CartSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Cart.objects.filter(user=self.request.user)
    
    def get_or_create_cart(self):
        """Get or create user cart"""
        cart, created = Cart.objects.get_or_create(
            user=self.request.user,
            defaults={'currency': 'BRL'}
        )
        return cart
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current user cart"""
        cart = self.get_or_create_cart()
        serializer = self.get_serializer(cart)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def add_item(self, request):
        """Add item to cart"""
        cart = self.get_or_create_cart()
        
        product_id = request.data.get('product_id')
        variant_id = request.data.get('variant_id')
        quantity = int(request.data.get('quantity', 1))
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({
                'error': 'Produto não encontrado.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create cart item
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            variant_id=variant_id,
            defaults={
                'quantity': quantity,
                'unit_price': product.price
            }
        )
        
        if not created:
            cart_item.quantity += quantity
            cart_item.save()
        
        serializer = CartItemSerializer(cart_item, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['put'])
    def update_item(self, request):
        """Update cart item quantity"""
        cart = self.get_or_create_cart()
        item_id = request.data.get('item_id')
        quantity = int(request.data.get('quantity', 1))
        
        try:
            cart_item = cart.items.get(id=item_id)
            cart_item.quantity = quantity
            cart_item.save()
            
            serializer = CartItemSerializer(cart_item, context={'request': request})
            return Response(serializer.data)
        
        except CartItem.DoesNotExist:
            return Response({
                'error': 'Item não encontrado no carrinho.'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['delete'])
    def remove_item(self, request):
        """Remove item from cart"""
        cart = self.get_or_create_cart()
        item_id = request.data.get('item_id')
        
        try:
            cart_item = cart.items.get(id=item_id)
            cart_item.delete()
            
            return Response({
                'message': 'Item removido do carrinho.'
            }, status=status.HTTP_200_OK)
        
        except CartItem.DoesNotExist:
            return Response({
                'error': 'Item não encontrado no carrinho.'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['delete'])
    def clear(self, request):
        """Clear cart"""
        cart = self.get_or_create_cart()
        cart.items.all().delete()
        
        return Response({
            'message': 'Carrinho limpo com sucesso.'
        }, status=status.HTTP_200_OK)

class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Orders API"""
    
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status']
    ordering = ['-created_at']
    
    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items')
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel order"""
        order = self.get_object()
        
        if order.status not in ['pending', 'confirmed']:
            return Response({
                'error': 'Pedido não pode ser cancelado.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        order.status = 'cancelled'
        order.cancelled_at = timezone.now()
        order.save()
        
        return Response({
            'message': 'Pedido cancelado com sucesso.'
        }, status=status.HTTP_200_OK)

class CouponViewSet(viewsets.ReadOnlyModelViewSet):
    """Coupons API"""
    
    queryset = Coupon.objects.filter(is_active=True)
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def validate_coupon(self, request):
        """Validate coupon code"""
        code = request.data.get('code', '').upper()
        
        try:
            coupon = Coupon.objects.get(code=code, is_active=True)
            
            # Check if coupon is valid
            now = timezone.now()
            if coupon.expires_at and coupon.expires_at < now:
                return Response({
                    'valid': False,
                    'message': 'Cupom expirado.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
                return Response({
                    'valid': False,
                    'message': 'Cupom esgotado.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = self.get_serializer(coupon)
            return Response({
                'valid': True,
                'coupon': serializer.data
            })
        
        except Coupon.DoesNotExist:
            return Response({
                'valid': False,
                'message': 'Cupom inválido.'
            }, status=status.HTTP_404_NOT_FOUND)
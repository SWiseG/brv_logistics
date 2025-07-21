from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Avg, Count, F
from django.utils import timezone
from decimal import Decimal

from datetime import timedelta
from django.contrib.auth.models import AnonymousUser
from django.core.mail import send_mail
from django.conf import settings

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
    ).prefetch_related('images', 'variants', 'attribute_values', 'reviews')
    
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

    @action(detail=True, methods=['get'])
    def quick_view(self, request, pk=None):
        """Visualização rápida do produto"""
        product = self.get_object()
        
        # Adicionar aos produtos visualizados recentemente
        if request.user.is_authenticated:
            RecentlyViewedProduct.objects.get_or_create(
                user=request.user,
                product=product,
                defaults={'viewed_at': timezone.now()}
            )
        
        serializer = ProductSerializer(product, context={'request': request})
        
        return Response({
            'success': True,
            'product': serializer.data
        })

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
    def update_item_qtd(self, request):
        """Atualizar quantidade de produto ao carrinho"""
        product_id = int(request.data.get('item_id'))
        change_qtd = int(request.data.get('quantity', 1))
        
        if not product_id:
            return Response({
                'success': False,
                'message': 'ID do produto é obrigatório'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Produto não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create cart
        cart, created = Cart.objects.get_or_create(
            user=request.user,
            defaults={'currency': 'BRL'}
        )
        
        # Check if item already exists in cart
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={
                'unit_price': product.price
            }
        )
        
        # Update quantity
        cart_item.quantity = change_qtd
        cart_item.save()
            
        cart_serializer = self.get_serializer(cart).data
        
        return Response({
            'success': True,
            'item_qtd': change_qtd,
            'cart': cart_serializer,
            'message': 'Quantidade do Produto reduzida do carrinho com sucesso'
        })
        
    @action(detail=False, methods=['post'])
    def decrease_qtd_item(self, request):
        """Remover quantidade de produto ao carrinho"""
        product_id = int(request.data.get('item_id'))
        change_qtd = int(request.data.get('quantity', 1))
        
        if not product_id:
            return Response({
                'success': False,
                'message': 'ID do produto é obrigatório'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Produto não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create cart
        cart, created = Cart.objects.get_or_create(
            user=request.user,
            defaults={'currency': 'BRL'}
        )
        
        # Check if item already exists in cart
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={
                'unit_price': product.price
            }
        )
        
        # Update quantity
        cart_item.quantity -= change_qtd
        cart_item.save()
            
        cart_serializer = self.get_serializer(cart).data
        
        return Response({
            'success': True,
            'item_qtd': change_qtd,
            'cart': cart_serializer,
            'message': 'Quantidade do Produto reduzida do carrinho com sucesso'
        })
        
    @action(detail=False, methods=['post'])
    def increase_qtd_item(self, request):
        """Adicionar quantidade de produto ao carrinho"""
        product_id = int(request.data.get('item_id'))
        change_qtd = int(request.data.get('quantity', 1))
        
        if not product_id:
            return Response({
                'success': False,
                'message': 'ID do produto é obrigatório'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Produto não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create cart
        cart, created = Cart.objects.get_or_create(
            user=request.user,
            defaults={'currency': 'BRL'}
        )
        
        # Check if item already exists in cart
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={
                'unit_price': product.price
            }
        )
        
        # Update quantity
        cart_item.quantity += change_qtd
        cart_item.save()
            
        cart_serializer = self.get_serializer(cart).data
        
        return Response({
            'success': True,
            'item_qtd': change_qtd,
            'cart': cart_serializer,
            'message': 'Quantidade do Produto reduzida do carrinho com sucesso'
        })
        
    @action(detail=False, methods=['delete'])
    def remove_item(self, request):
        """Remover o produto ao carrinho"""
        item_id = int(request.data.get('item_id'))
        cart = self.get_or_create_cart()
        status_code = status.HTTP_200_OK
        status_bool = True
        message = 'Item removido com sucesso do carrinho'
        
        try:
            cart_item = cart.items.get(id=item_id)
            cart_item.delete()
        except CartItem.DoesNotExist:
            status_code=status.HTTP_404_NOT_FOUND
            status_bool=False
            message='Item não encontrado no carrinho. Portanto não removido'
            
        cart_serializer = self.get_serializer(cart).data
        
        return Response({
            'success': status_bool,
            'cart': cart_serializer,
            'message': message
        },status=status_code)
    
    @action(detail=False, methods=['delete'])
    def clear(self, request):
        """Limpar o carrinho"""
        cart = self.get_or_create_cart()
        
        status_code = status.HTTP_200_OK
        status_bool = True
        message = 'Carrinho limpo com sucesso'
        
        try:
            cart.items.all().delete()
        except Exception as e:
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            status_bool=False
            message=f'Não foi possivel limpar o carrinho. Erro: {e}'
            
        cart_serializer = self.get_serializer(cart).data
        
        return Response({
            'success': status_bool,
            'cart': cart_serializer,
            'message': message
        },status=status_code)

    # Revisar
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
            
            
class HomeAPIViewSet(viewsets.ViewSet):
    """APIs específicas para Home Page"""
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Categorias para home page"""
        categories = ProductCategory.objects.filter(
            is_active=True, 
            parent__isnull=True
        ).annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        ).order_by('sort_order')[:6]
        
        serializer = ProductCategorySerializer(categories, many=True, context={'request': request})
        return Response({
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def featured_products(self, request):
        """Produtos em destaque"""
        products = Product.objects.filter(
            is_active=True,
            is_featured=True
        ).select_related('category', 'brand').prefetch_related('images').annotate(
            avg_rating=Avg('reviews__rating'),
            review_count=Count('reviews')
        )[:8]
        
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def special_offers(self, request):
        """Produtos em oferta"""
        products = Product.objects.filter(
            is_active=True,
            compare_at_price__gt=F('price')
        ).select_related('category', 'brand').prefetch_related('images').annotate(
            avg_rating=Avg('reviews__rating'),
            review_count=Count('reviews'),
            discount_percent=((F('compare_at_price') - F('price')) / F('compare_at_price')) * 100
        ).order_by('-discount_percent')[:4]
        
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def popular_products(self, request):
        """Produtos populares (mais vendidos)"""
        # Produtos mais vendidos nos últimos 30 dias
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        products = Product.objects.filter(
            is_active=True
        ).select_related('category', 'brand').prefetch_related('images').annotate(
            avg_rating=Avg('reviews__rating'),
            review_count=Count('reviews'),
            sales_count=Count('orderitem', filter=Q(
                orderitem__order__created_at__gte=thirty_days_ago,
                orderitem__order__status__in=['confirmed', 'processing', 'shipped', 'delivered']
            ))
        ).order_by('-sales_count')[:8]
        
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({
            'results': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def new_products(self, request):
        """Produtos novos"""
        products = Product.objects.filter(
            is_active=True
        ).select_related('category', 'brand').prefetch_related('images').annotate(
            avg_rating=Avg('reviews__rating'),
            review_count=Count('reviews')
        ).order_by('-created_at')[:12]
        
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({
            'results': serializer.data
        })


class WishlistAPIViewSet(viewsets.ViewSet):
    """APIs para Wishlist"""
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """Toggle produto na wishlist"""
        product_id = request.data.get('product_id')
        
        if not product_id:
            return Response({
                'success': False,
                'message': 'ID do produto é obrigatório'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Produto não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create default wishlist
        wishlist, created = Wishlist.objects.get_or_create(
            user=request.user,
            is_default=True,
            defaults={'name': 'Minha Lista de Desejos'}
        )
        
        # Check if product is already in wishlist
        wishlist_item, created = WishlistItem.objects.get_or_create(
            wishlist=wishlist,
            product=product
        )
        
        if not created:
            # Remove from wishlist
            wishlist_item.delete()
            added = False
        else:
            added = True
        
        # Count total wishlist items
        wishlist_count = WishlistItem.objects.filter(
            wishlist__user=request.user,
            wishlist__is_default=True
        ).count()
        
        return Response({
            'success': True,
            'added': added,
            'wishlist_count': wishlist_count,
            'message': 'Produto adicionado aos favoritos!' if added else 'Produto removido dos favoritos!'
        })
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        """Contador da wishlist"""
        if not request.user.is_authenticated:
            return Response({'count': 0})
        
        wishlist_count = WishlistItem.objects.filter(
            wishlist__user=request.user,
            wishlist__is_default=True
        ).count()
        
        return Response({'count': wishlist_count})

    @action(detail=False, methods=['get'])
    def dropdown(self, request):
        """Dados do dropdown da wishlist"""
        if not request.user.is_authenticated:
            return Response({'success': False, 'message': 'Usuário não autenticado'})
        
        try:
            wishlist = Wishlist.objects.get(user=request.user, is_default=True)
            wishlist_items = wishlist.items.select_related('product').prefetch_related('product__images')
            
            items_data = []
            for item in wishlist_items:
                items_data.append({
                    'id': item.id,
                    'product': {
                        'id': item.product.id,
                        'name': item.product.name,
                        'primary_image': item.product.get_primary_image(),
                        'price': float(item.product.price)
                    },
                    'added_at': item.added_at.isoformat()
                })
            
            return Response({
                'success': True,
                'wishlist': {
                    'items': items_data,
                    'count': wishlist_items.count()
                }
            })
            
        except Wishlist.DoesNotExist:
            return Response({
                'success': True,
                'wishlist': {
                    'items': [],
                    'count': 0
                }
            })

    @action(detail=False, methods=['post'])
    def remove(self, request):
        """Remover item da wishlist"""
        item_id = request.data.get('item_id')
        
        if not item_id:
            return Response({
                'success': False,
                'message': 'ID do item é obrigatório'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            wishlist_item = WishlistItem.objects.get(
                id=item_id,
                wishlist__user=request.user
            )
            wishlist_item.delete()
            
            # Contar itens restantes
            wishlist_count = WishlistItem.objects.filter(
                wishlist__user=request.user,
                wishlist__is_default=True
            ).count()
            
            return Response({
                'success': True,
                'wishlist_count': wishlist_count,
                'message': 'Item removido dos favoritos!'
            })
            
        except WishlistItem.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Item não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)

class CartAPIViewSet(viewsets.ViewSet):
    """APIs para Carrinho"""
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def add(self, request):
        """Adicionar produto ao carrinho"""
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))
        variant_id = request.data.get('variant_id')
        
        if not product_id:
            return Response({
                'success': False,
                'message': 'ID do produto é obrigatório'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Produto não encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create cart
        cart, created = Cart.objects.get_or_create(
            user=request.user,
            defaults={'currency': 'BRL'}
        )
        
        # Check if item already exists in cart
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
            # Update quantity
            cart_item.quantity += quantity
            cart_item.save()
        
        # Count total cart items
        cart_count = CartItem.objects.filter(cart__user=request.user).count()
        
        return Response({
            'success': True,
            'cart_count': cart_count,
            'message': 'Produto adicionado ao carrinho!'
        })
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        """Contador do carrinho"""
        if not request.user.is_authenticated:
            return Response({'count': 0})
        
        cart_count = CartItem.objects.filter(
            cart__user=request.user
        ).count()
        
        return Response({'count': cart_count})

    @action(detail=False, methods=['get'])
    def dropdown(self, request):
        """Dados do dropdown do carrinho"""
        if not request.user.is_authenticated:
            return Response({'success': False, 'message': 'Usuário não autenticado'})
        
        try:
            cart = Cart.objects.get(user=request.user)
            cart_items = cart.items.select_related('product').prefetch_related('product__images')
            
            items_data = []
            for item in cart_items:
                items_data.append({
                    'id': item.id,
                    'product': {
                        'id': item.product.id,
                        'name': item.product.name,
                        'primary_image': item.product.get_primary_image(),
                        'price': float(item.product.price)
                    },
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'total_price': float(item.total_price)
                })
            
            return Response({
                'success': True,
                'cart': {
                    'items': items_data,
                    'total': float(cart.total_amount),
                    'count': cart_items.count()
                }
            })
            
        except Cart.DoesNotExist:
            return Response({
                'success': True,
                'cart': {
                    'items': [],
                    'total': 0,
                    'count': 0
                }
            })

class NewsletterAPIViewSet(viewsets.ViewSet):
    """APIs para Newsletter"""
    
    @action(detail=False, methods=['post'])
    def subscribe(self, request):
        """Inscrever-se na newsletter"""
        email = request.data.get('email', '').strip().lower()
        
        if not email:
            return Response({
                'success': False,
                'message': 'Email é obrigatório'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return Response({
                'success': False,
                'message': 'Email inválido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already subscribed
        from marketing.models import NewsletterSubscription
        
        subscription, created = NewsletterSubscription.objects.get_or_create(
            email=email,
            defaults={
                'is_active': True,
                'subscribed_at': timezone.now()
            }
        )
        
        if not created:
            if subscription.is_active:
                return Response({
                    'success': False,
                    'message': 'Este email já está cadastrado'
                }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Reactivate subscription
                subscription.is_active = True
                subscription.subscribed_at = timezone.now()
                subscription.save()
        
        # Send welcome email (optional)
        try:
            send_mail(
                subject='Bem-vindo à nossa newsletter!',
                message=f'Obrigado por se inscrever em nossa newsletter. Você receberá as melhores ofertas e novidades!',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True
            )
        except:
            pass
        
        return Response({
            'success': True,
            'message': 'Cadastro realizado com sucesso!'
        })

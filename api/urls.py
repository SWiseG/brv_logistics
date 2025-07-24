from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router
router = DefaultRouter()

# Register existing viewsets
router.register(r'categories', views.ProductCategoryViewSet, basename='category')
router.register(r'brands', views.ProductBrandViewSet, basename='brand')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'cart', views.CartViewSet, basename='cart')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'coupons', views.CouponViewSet, basename='coupon')

# Register new viewsets
router.register(r'home', views.HomeViewSet, basename='home')
router.register(r'wishlist', views.WishlistViewSet, basename='wishlist')
router.register(r'newsletter', views.NewsletterViewSet, basename='newsletter')


# API URLs
urlpatterns = [
    path('', include(router.urls)),
]

# Endpoints disponíveis:
# GET    /api/v1/home/categories/          - Categorias para home
# GET    /api/v1/home/featured_products/   - Produtos em destaque
# GET    /api/v1/home/special_offers/      - Produtos em oferta
# GET    /api/v1/home/popular_products/    - Produtos populares
# GET    /api/v1/home/new_products/        - Produtos novos
# POST   /api/v1/wishlist/toggle/          - Toggle wishlist
# POST   /api/v1/cart-api/add/             - Adicionar ao carrinho
# POST   /api/v1/newsletter/subscribe/     - Inscrever newsletter
# GET    /api/v1/search/suggestions/       - Sugestões de busca
# GET    /api/v1/products/{id}/quick_view/ - Visualização rápida
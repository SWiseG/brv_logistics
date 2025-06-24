from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router
router = DefaultRouter()

# Register viewsets
router.register(r'categories', views.ProductCategoryViewSet, basename='category')
router.register(r'brands', views.ProductBrandViewSet, basename='brand')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'cart', views.CartViewSet, basename='cart')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'coupons', views.CouponViewSet, basename='coupon')


# API URLs
urlpatterns = [
    path('', include(router.urls)),
]

# URL patterns for reference:
# GET    /api/v1/categories/              - List categories
# GET    /api/v1/categories/{id}/         - Category detail
# GET    /api/v1/categories/{id}/products/ - Products in category
# 
# GET    /api/v1/brands/                  - List brands
# GET    /api/v1/brands/{id}/             - Brand detail
# 
# GET    /api/v1/products/                - List products (with filters)
# GET    /api/v1/products/{id}/           - Product detail
# GET    /api/v1/products/{id}/reviews/   - Product reviews
# POST   /api/v1/products/{id}/add_review/ - Add review
# GET    /api/v1/products/featured/       - Featured products
# GET    /api/v1/products/search/         - Search products
# 
# GET    /api/v1/cart/current/            - Current user cart
# POST   /api/v1/cart/add_item/           - Add item to cart
# PUT    /api/v1/cart/update_item/        - Update cart item
# DELETE /api/v1/cart/remove_item/        - Remove cart item
# DELETE /api/v1/cart/clear/              - Clear cart
# 
# GET    /api/v1/orders/                  - List user orders
# GET    /api/v1/orders/{id}/             - Order detail
# POST   /api/v1/orders/{id}/cancel/      - Cancel order
# 
# GET    /api/v1/coupons/                 - List coupons
# POST   /api/v1/coupons/validate_coupon/ - Validate coupon
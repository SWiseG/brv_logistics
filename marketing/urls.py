from django.urls import path
from . import views

app_name = 'marketing'

urlpatterns = [
    # Wishlist
    # path('lista-desejos/', views.WishlistView.as_view(), name='wishlist'),
    # path('lista-desejos/adicionar/', views.AddToWishlistView.as_view(), name='add_to_wishlist'),
    # path('lista-desejos/remover/', views.RemoveFromWishlistView.as_view(), name='remove_from_wishlist'),
    
    # # Cupons
    # path('cupons/', views.CouponsView.as_view(), name='coupons'),
    # path('validar-cupom/', views.ValidateCouponView.as_view(), name='validate_coupon'),
]


app_name = 'wishlist'
urlpatterns += [
    # path('', views.WishlistView.as_view(), name='index'),
    path('wishlist/count/', views.UpdateWishlistCountView.as_view(), name='wishlist_count'),
]
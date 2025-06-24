from django.urls import path
from . import views

app_name = 'orders'

urlpatterns = [
    # Carrinho
    # path('carrinho/', views.CartView.as_view(), name='cart'),
    # path('carrinho/adicionar/', views.AddToCartView.as_view(), name='add_to_cart'),
    # path('carrinho/remover/', views.RemoveFromCartView.as_view(), name='remove_from_cart'),
    # path('carrinho/atualizar/', views.UpdateCartView.as_view(), name='update_cart'),
    
    # # Checkout
    # path('checkout/', views.CheckoutView.as_view(), name='checkout'),
    # path('checkout/confirmar/', views.ConfirmOrderView.as_view(), name='confirm_order'),
    
    # # Pedidos
    # path('meus-pedidos/', views.MyOrdersView.as_view(), name='my_orders'),
    # path('pedido/<uuid:uuid>/', views.OrderDetailView.as_view(), name='order_detail'),
    
    # Cart dropdown AJAX
    path('cart/dropdown/', views.CartDropdownView.as_view(), name='cart_dropdown'),
    path('cart/count/', views.UpdateCartCountView.as_view(), name='cart_count'),
]


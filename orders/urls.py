from django.urls import path
from . import views

app_name = 'orders'

urlpatterns = [
    path('carrinho/', views.cart_detail, name='cart_detail'),
    path('checkout/', views.checkout, name='checkout'),
    path('pedidos/', views.order_list, name='order_list'),
    path('pedido/<str:order_number>/', views.order_detail, name='order_detail'),
]


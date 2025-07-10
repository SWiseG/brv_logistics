from django.urls import path
from .views import *

app_name = 'products'

urlpatterns = [
    # Busca
    path('buscar/', ProductSearchView.as_view(), name='search'),
    
    # Categorias
    path('categoria/<slug:slug>/', CategoryView.as_view(), name='category'),
    
    # Produtos
    path('produto/<slug:slug>/', ProductDetailView.as_view(), name='detail'),
    path('ofertas/', OffersView.as_view(), name='offers'),
    
    # Listagem geral
    path('', ProductListView.as_view(), name='list'),
]
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', include('core.urls')),
    
    path('admin/', admin.site.urls),
    path('conta/', include('users.urls')),
    path('accounts/', include('allauth.urls')),
    
    path('dashboard/', include('analytics.urls')),
    path('marketing/', include('marketing.urls')),
    
    path('produtos/', include('products.urls')),
    path('fornecedor/', include('suppliers.urls')),
    path('pedidos/', include('orders.urls')),
    
    path('estoque/', include('inventory.urls')),
    path('pagamento/', include('payments.urls')),
    path('entrega/', include('shipping.urls'))
]

# Servir arquivos de mídia em desenvolvimento
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


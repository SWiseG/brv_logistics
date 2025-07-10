from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# Swagger/OpenAPI Schema
schema_view = get_schema_view(
    openapi.Info(
        title="BRV Logistics API",
        default_version='v1',
        description="BRV Logistics API completa para sistema de e-commerce",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="notifybravasyssolutions@gmail.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    # API Documentation
    path('swagger/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    # API Endpoints
    path('api/v1/', include('api.urls')),
    path('auth/', include('authentication.urls')),
    
    # Web Interface (opcional)
    path('', include('core.urls')),
    
    path('admin/', admin.site.urls),
    path('conta/', include('users.urls')),
    
    path('dashboard/', include('analytics.urls')),
    path('marketing/', include('marketing.urls')),
    
    path('produtos/', include('products.urls')),
    path('fornecedor/', include('suppliers.urls')),
    path('pedidos/', include('orders.urls')),
    
    path('estoque/', include('inventory.urls')),
    path('pagamento/', include('payments.urls')),
    path('entrega/', include('shipping.urls'))
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


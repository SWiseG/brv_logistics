def system_context(request):
    """
    Adiciona as configs do sistema ativo ao contexto de todos os templates
    """
    from ecommerce_template.settings import DEBUG
    import json
    
    debugging = 'true'
    if DEBUG == False: 
        debugging = 'false'
            
    try:
        from core.models import SiteSettings
        sys_config = SiteSettings.objects.get(is_active=True)
    except:
        sys_config = None
    
    return {
        'sys_is_debugging': json.dumps({
            'debug': debugging,
            'name': sys_config.site_name,
            'description': sys_config.site_description,
            'email': sys_config.contact_email,
            'phone': sys_config.contact_phone,
            'currency': sys_config.currency,
            # 'language': sys_config.language,
            # 'allowedThemes': sys_config.get_allowed_themes(),
            # 'allowedLanguages': sys_config.get_allowed_langs(),
        }),
        'sys_config': sys_config,
        'nav_settings': navbar_context(request)
    }
    
def navbar_context(request):
    """Context processor para dados da navbar disponíveis em todos os templates"""
    from django.db.models import Count, Sum, Q
    from django.core.cache import cache
    cache_key = 'navbar_main_categories'
    main_categories = cache.get(cache_key)
    
    if not main_categories:
        from products.models import ProductCategory
        main_categories = ProductCategory.objects.filter(
            is_active=True,
            parent__isnull=True  # Apenas categorias pai
        ).prefetch_related(
            'children'  # Subcategorias
        ).annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        ).order_by('sort_order', 'name')[:5]  # Limitar a 5 categorias principais
        
        # Cache por 1 hora
        cache.set(cache_key, main_categories, 3600)
    
    context = { 'main_categories': main_categories }
        
    # Dados específicos para usuários autenticados
    if request.user.is_authenticated:
        # Contador do carrinho
        from orders.models import CartItem
        cart_count = CartItem.objects.filter(
            cart__user=request.user
        ).aggregate(
            total_items=Sum('quantity')
        )['total_items'] or 0
        
        # Contador da wishlist
        from marketing.models import WishlistItem
        wishlist_count = WishlistItem.objects.filter(
            wishlist__user=request.user,
            wishlist__is_default=True
        ).count()
        
        context.update({
            'cart_count': cart_count,
            'wishlist_count': wishlist_count,
        })
    else:
        # Para usuários não logados, usar sessão
        session_cart_count = 0
        if 'cart_items' in request.session:
            session_cart_count = sum(
                item['quantity'] for item in request.session['cart_items'].values()
            )
        
        context.update({
            'cart_count': session_cart_count,
            'wishlist_count': 0,
        })
    
    return context
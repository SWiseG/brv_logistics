from django.db import models

def theme_context(request):
    """
    Adiciona o tema ativo ao contexto de todos os templates
    """
    try:
        from theme.models import Theme
        try:
            active_theme = Theme.objects.get(is_active=True)
        except Theme.DoesNotExist:
            try:
                active_theme = Theme.objects.get(is_default=True)
            except Theme.DoesNotExist:
                active_theme = None
    except:
        active_theme = None
    
    return {
        'active_theme': active_theme
    }
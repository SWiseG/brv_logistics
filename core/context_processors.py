from django.db import models

def system_context(request):
    """
    Adiciona as configs do sistema ativo ao contexto de todos os templates
    """
    try:
        from core.models import SiteSettings
        sys_config = SiteSettings.objects.get(is_active=True)
    except:
        sys_config = None
    
    return {
        'sys_config': sys_config
    }
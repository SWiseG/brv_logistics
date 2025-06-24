from django.db import models

def theme_context(request):
    """
    Adiciona o tema ativo ao contexto de todos os templates
    """
    active_theme = None
    try:
        from users.models import UserPreferences
        from theme.models import Theme
        
        if request.user.is_authenticated:
            active_theme = UserPreferences.objects.filter(type="T").first()
        
        if not active_theme or active_theme == '':
            active_theme = Theme.objects.filter(is_active=True).first()
        
        if not active_theme or active_theme == '':
            active_theme = Theme.objects.filter(is_default=True).first()
            
    except:
        active_theme = None
    
    return {
        'active_theme': active_theme
    }
    
def lang_context(request):
    """
    Adiciona a linguagem ativa ao contexto de todos os templates
    """
    active_lang = None
    try:
        from core.models import Languages
        from users.models import UserPreferences
        
        if request.user.is_authenticated:
            active_lang = UserPreferences.objects.filter(type="L").first()
        
        if not active_lang or active_lang == '':
            active_lang = Languages.objects.filter(is_active=True).first()
            
    except:
        active_lang = None
    
    return {
        'active_lang': active_lang
    }
from ..models import SiteSettings
from django.core.cache import cache

class ConfigService:
    _local_cache = {}
    _cache_timeout = 3600  # 1 hora

    @classmethod
    def get(cls, chave, default=None):
        cache_key = f'config:{chave}'

        # Primeiro tenta no cache de memória
        if chave in cls._local_cache:
            return cls._local_cache[chave]

        # Depois tenta no cache distribuído (ex: Redis ou Memcached)
        valor = cache.get(cache_key)
        if valor is not None:
            cls._local_cache[chave] = valor
            return valor

        # Se não tiver, consulta o banco
        try:
            valor = SiteSettings.objects.filter(is_active=True).values_list(chave, flat=True).first()
            if not valor or valor == '': valor = default
            # Salva no cache de memória e no cache distribuído
            cls._local_cache[chave] = valor
            cache.set(cache_key, valor, timeout=cls._cache_timeout)
            return valor
        except SiteSettings.DoesNotExist:
            return default

    @classmethod
    def reload(cls, chaves):
        """Força recarregar uma configuração específica"""
        for chave in chaves:
            try:
                valor = SiteSettings.objects.filter(is_active=True).values_list(chave, flat=True).first()
                cls._local_cache[chave] = valor
                cache.set(f'config:{chave}', valor, timeout=cls._cache_timeout)
            except SiteSettings.DoesNotExist:
                cls._local_cache.pop(chave, None)
                cache.delete(f'config:{chave}')

    @classmethod
    def clear_all_cache(cls):
        """Limpa todo cache interno e externo de configs"""
        cls._local_cache.clear()
        # Opcional: Limpar tudo no cache externo com prefixo
        for chave in cache.keys('config:*'):
            cache.delete(chave)

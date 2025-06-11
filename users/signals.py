from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Address

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Cria um endereço padrão para novos usuários
    """
    if created and instance.is_customer:
        # Aqui você pode adicionar lógica para criar um endereço padrão se necessário
        pass

from models.base import BaseModel, BaseModelWithoutSoftDelete
from django.contrib.auth.models import AbstractUser, Group
from django.db.models import Q, CheckConstraint
from django.db import models
import random
import string
from django.utils import timezone
from datetime import timedelta

class User(AbstractUser, BaseModelWithoutSoftDelete):
    GENDER_CHOICES = [
        ('M', 'Masculino'),
        ('F', 'Feminino'),
        ('O', 'Outro'),
        ('P', 'Prefiro não informar'),
    ]
    date_of_birth = models.DateField(null=True, blank=True, verbose_name='Data de Nascimento')
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, verbose_name='Gênero')
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    is_customer = models.BooleanField(default=True)
    is_merchant = models.BooleanField(default=False)
    date_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            CheckConstraint(
                check=models.Q(phone__isnull=True) | ~models.Q(phone=''),
                name='phone_not_empty_if_provided'
            ),
        ]

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return self.email
    
class GroupType(BaseModel):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='group')
    is_adm = models.BooleanField(default=False)
    is_dev = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = 'Grupo Categoria'
        verbose_name_plural = 'Grupo Categorias'

class Address(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    address_type = models.CharField(max_length=10, choices=[('billing', 'Faturamento'), ('shipping', 'Entrega'), ('both', 'Ambos')])
    street = models.CharField(max_length=255)
    number = models.CharField(max_length=20)
    complement = models.CharField(max_length=255, blank=True, null=True)
    neighborhood = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default='Brasil')
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    postal_code = models.CharField(max_length=10)
    is_default = models.BooleanField(default=False)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'address'
        verbose_name = 'Endereço'
        verbose_name_plural = 'Endereços'
        unique_together = ('user', 'address_type', 'is_default')
        indexes = [
            models.Index(fields=['user', 'address_type']),
            models.Index(fields=['postal_code']),
            models.Index(fields=['is_default']),
        ]
        constraints = [
            CheckConstraint(
                check=~Q(street=''),
                name='street'
            ),
            CheckConstraint(
                check=~Q(city=''),
                name='city_not_empty'
            )
    ]
    def save(self, *args, **kwargs):
        # Garantir apenas um endereço padrão por tipo
        if self.is_default:
            Address.objects.filter(
                user=self.user,
                address_type=self.address_type,
                is_default=True
            ).update(is_default=False)
        super().save(*args, **kwargs)
        
    def get_full_address(self):
        parts = [self.street, self.number]
        parts.extend([self.city, self.state, self.postal_code, self.country])
        return ', '.join(parts)
    
    def __str__(self):
        return f"{self.address_type} - {self.get_full_address()}"
    
class EmailVerification(models.Model):
    """Model para armazenar códigos de verificação por email"""
    
    email = models.EmailField()
    verification_code = models.CharField(max_length=6)
    verification_type = models.CharField(
        max_length=20,
        choices=[
            ('registration', 'Cadastro'),
            ('password_reset', 'Reset de Senha'),
            ('email_change', 'Alteração de Email'),
            ('login_verification', 'Verificação de Login')
        ],
        default='registration'
    )
    
    # Dados temporários do usuário (para registro)
    temp_user_data = models.JSONField(default=dict, blank=True)
    
    # Controle de tentativas
    attempts = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=3)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Status
    is_used = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Verificação de Email'
        verbose_name_plural = 'Verificações de Email'
        indexes = [
            models.Index(fields=['email', 'verification_type']),
            models.Index(fields=['verification_code']),
            models.Index(fields=['expires_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.verification_code:
            self.verification_code = self.generate_code()
        
        if not self.expires_at:
            # Código expira em 10 minutos
            self.expires_at = timezone.now() + timedelta(minutes=10)
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_code():
        """Gera código de 6 dígitos"""
        return ''.join(random.choices(string.digits, k=6))
    
    def is_expired(self):
        """Verifica se o código expirou"""
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """Verifica se o código ainda é válido"""
        return (
            self.is_active and 
            not self.is_used and 
            not self.is_expired() and 
            self.attempts < self.max_attempts
        )
    
    def verify(self, code):
        """Verifica o código fornecido"""
        self.attempts += 1
        
        if not self.is_valid():
            self.save()
            return False, "Código inválido ou expirado"
        
        if self.verification_code == code:
            self.verified_at = timezone.now()
            self.is_used = True
            self.save()
            return True, "Código verificado com sucesso"
        else:
            self.save()
            remaining = self.max_attempts - self.attempts
            if remaining > 0:
                return False, f"Código incorreto. Você tem {remaining} tentativa(s) restante(s)"
            else:
                self.is_active = False
                self.save()
                return False, "Muitas tentativas incorretas. Solicite um novo código"
    
    @classmethod
    def create_verification(cls, email, verification_type='registration', temp_data=None):
        """Cria nova verificação e invalida as anteriores"""
        
        # Invalidar verificações anteriores do mesmo email e tipo
        cls.objects.filter(
            email__iexact=email,
            verification_type=verification_type,
            is_active=True
        ).update(is_active=False)
        
        # Criar nova verificação
        verification = cls.objects.create(
            email=email.lower(),
            verification_type=verification_type,
            temp_user_data=temp_data or {}
        )
        
        return verification
    
    def __str__(self):
        return f"{self.email} - {self.verification_type} - {self.verification_code}"

class UserPasswordChange(models.Model):
    """Histórico de alterações de senha"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_changes')
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Método de alteração
    change_method = models.CharField(
        max_length=20,
        choices=[
            ('self_change', 'Alteração pelo usuário'),
            ('reset_by_email', 'Reset por email'),
            ('admin_change', 'Alteração pelo admin'),
            ('forced_change', 'Alteração forçada'),
        ],
        default='self_change'
    )
    
    # Informações de segurança
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Timestamps
    changed_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        verbose_name = 'Alteração de Senha'
        verbose_name_plural = 'Alterações de Senha'
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['user', 'changed_at']),
            models.Index(fields=['change_method']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.get_change_method_display()} - {self.changed_at}"

class UserPreferences(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_pref')
    PREFERNCES_CHOICES = [
        ('L', 'Languages'),
        ('T', 'Themes'),
    ]
    type = models.CharField(max_length=1, choices=PREFERNCES_CHOICES, blank=True, verbose_name='Tipo')
    value = models.TextField(max_length=2000,verbose_name="Valor")
    
    class Meta:
        verbose_name = 'Preferência do Usuário'
        verbose_name_plural = 'Preferências do Usuários'

class UserLoginAttempt(models.Model):
    """Model para rastrear tentativas de login"""
    
    email = models.EmailField()
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    
    # Status da tentativa
    success = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=100, blank=True)
    
    # Verificação requerida
    requires_verification = models.BooleanField(default=False)
    verification_sent = models.BooleanField(default=False)
    
    # Timestamps
    attempted_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        verbose_name = 'Tentativa de Login'
        verbose_name_plural = 'Tentativas de Login'
        indexes = [
            models.Index(fields=['email', 'attempted_at']),
            models.Index(fields=['ip_address', 'attempted_at']),
        ]
    
    @classmethod
    def check_security_requirements(cls, email, ip_address):
        """Verifica se login requer verificação adicional"""
        
        # Verificar tentativas falhadas recentes (última hora)
        recent_failures = cls.objects.filter(
            email__iexact=email,
            success=False,
            attempted_at__gte=timezone.now() - timedelta(hours=1)
        ).count()
        
        # Verificar login de IP diferente (últimos 7 dias)
        recent_ips = cls.objects.filter(
            email__iexact=email,
            success=True,
            attempted_at__gte=timezone.now() - timedelta(days=7)
        ).values_list('ip_address', flat=True).distinct()
        
        requires_verification = (
            recent_failures >= 3 or  # Muitas tentativas falhadas
            (recent_ips and ip_address not in recent_ips)  # IP novo
        )
        
        return requires_verification
    
    def __str__(self):
        status = "Sucesso" if self.success else "Falha"
        return f"{self.email} - {status} - {self.attempted_at}"
    
class Wishlist(BaseModel):
    """Lista de desejos do usuário (privada ou compartilhada)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wishlists', verbose_name='Usuário')
    name = models.CharField(max_length=100, default='Minha Lista de Desejos', verbose_name='Nome da Lista')
    description = models.TextField(blank=True, verbose_name='Descrição')
    is_default = models.BooleanField(default=True, verbose_name='Lista Padrão')
    is_public = models.BooleanField(default=False, verbose_name='Lista Pública')
    is_shared = models.BooleanField(default=False, verbose_name='Lista Compartilhada')
    share_token = models.CharField(max_length=32, unique=True, blank=True, verbose_name='Token de Compartilhamento')
    shared_with = models.ManyToManyField(User, related_name='shared_wishlists', blank=True, verbose_name='Compartilhada com')
    
    class Meta:
        verbose_name = 'Lista de Desejos'
        verbose_name_plural = 'Listas de Desejos'
        unique_together = ['user', 'name']
        indexes = [
            models.Index(fields=['user', 'is_default']),
            models.Index(fields=['share_token']),
            models.Index(fields=['is_public']),
        ]
    
    def save(self, *args, **kwargs):
        # Gerar token de compartilhamento se necessário
        if not self.share_token:
            import secrets
            self.share_token = secrets.token_urlsafe(16)
        
        # Garantir apenas uma lista padrão por usuário
        if self.is_default:
            Wishlist.objects.filter(user=self.user, is_default=True).update(is_default=False)
        
        super().save(*args, **kwargs)
    
    def get_share_url(self):
        from django.urls import reverse
        return reverse('users:wishlist_shared', kwargs={'token': self.share_token})
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.name}"

class WishlistItem(BaseModel):
    """Itens da lista de desejos"""
    wishlist = models.ForeignKey(Wishlist, on_delete=models.CASCADE, related_name='items', verbose_name='Lista')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, verbose_name='Produto')
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.CASCADE, null=True, blank=True, verbose_name='Variante')
    added_at = models.DateTimeField(auto_now_add=True, verbose_name='Adicionado em')
    note = models.TextField(blank=True, verbose_name='Observação')
    priority = models.IntegerField(default=1, choices=[
        (1, 'Baixa'),
        (2, 'Média'), 
        (3, 'Alta'),
        (4, 'Urgente')
    ], verbose_name='Prioridade')
    
    class Meta:
        verbose_name = 'Item da Lista de Desejos'
        verbose_name_plural = 'Itens das Listas de Desejos'
        unique_together = ['wishlist', 'product', 'variant']
        ordering = ['-priority', '-added_at']
        indexes = [
            models.Index(fields=['wishlist', 'added_at']),
            models.Index(fields=['product']),
        ]
    
    def __str__(self):
        return f"{self.wishlist.name} - {self.product.name}"
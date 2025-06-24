from datetime import timedelta
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid
import random
import string
from models.base import BaseModel
from products.models import Product, ProductVariant

User = get_user_model()

def default_expires_at():
    return timezone.now() + timedelta(days=30)

class Cart(BaseModel):
    """Carrinho de compras"""
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True, related_name='shopping_carts', verbose_name='Usuário')
    session_key = models.CharField(max_length=100, null=True, blank=True, verbose_name='Chave da Sessão')  # Para usuários não logados
    currency = models.CharField(max_length=3, default='BRL', verbose_name='Moeda')
    expires_at = models.DateTimeField(default=default_expires_at, verbose_name='Expira em')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Carrinho de Compras'
        verbose_name_plural = 'Carrinhos de Compras'
        ordering = ['-updated_at']
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(user__isnull=False, session_key__isnull=True) |
                    models.Q(user__isnull=True, session_key__isnull=False)
                ),
                name='cart_user_or_session'
            )
        ]

    def __str__(self):
        if self.user:
            return f"Carrinho de {self.user.get_full_name() or self.user.username}"
        return f"Carrinho da sessão {self.session_key}"

    @property
    def total_items(self):
        return self.items.aggregate(total=models.Sum('quantity'))['total'] or 0

    @property
    def subtotal(self):
        return sum(item.total_price for item in self.items.all())

    def clear(self):
        """Limpa todos os itens do carrinho"""
        self.items.all().delete()


class CartItem(BaseModel):
    """Itens do carrinho"""
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items', verbose_name='Carrinho')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name='Produto')
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, null=True, blank=True, verbose_name='Variante')
    quantity = models.PositiveIntegerField(verbose_name='Quantidade')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Preço Unitário')  # Preço no momento da adição
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Item do Carrinho'
        verbose_name_plural = 'Itens do Carrinho'
        unique_together = ['cart', 'product', 'variant']
        ordering = ['-created_at']

    def __str__(self):
        product_name = self.variant.product.name if self.variant else self.product.name
        return f"{product_name} x{self.quantity}"

    @property
    def total_price(self):
        return self.unit_price * self.quantity

    def save(self, *args, **kwargs):
        # Atualiza o preço automaticamente se não foi definido
        if not self.unit_price:
            if self.variant:
                self.unit_price = self.variant.effective_price
            else:
                self.unit_price = self.product.price
        super().save(*args, **kwargs)


class Order(BaseModel):
    """Pedidos principais"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmado'),
        ('processing', 'Processando'),
        ('shipped', 'Enviado'),
        ('delivered', 'Entregue'),
        ('cancelled', 'Cancelado'),
        ('refunded', 'Reembolsado'),
        ('partially_refunded', 'Parcialmente Reembolsado'),
        ('returned', 'Devolvido'),
    ]
    
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    order_number = models.CharField(max_length=50, unique=True, verbose_name='Número do Pedido')
    user = models.ForeignKey('users.User', on_delete=models.PROTECT, null=True, blank=True, related_name='orders', verbose_name='Usuário')
    
    # Status
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending', verbose_name='Status')
    
    # Endereços
    billing_address = models.JSONField(verbose_name='Endereço de Cobrança')
    shipping_address = models.JSONField(verbose_name='Endereço de Entrega')
    
    # Valores
    currency = models.CharField(max_length=3, default='BRL', verbose_name='Moeda')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Subtotal')
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Valor dos Impostos')
    shipping_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Valor do Frete')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Valor do Desconto')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Valor Total')
    
    # Informações adicionais
    notes = models.TextField(blank=True, verbose_name='Observações')
    internal_notes = models.TextField(blank=True, verbose_name='Observações Internas')
    
    # Datas importantes
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='Confirmado em')
    shipped_at = models.DateTimeField(null=True, blank=True, verbose_name='Enviado em')
    delivered_at = models.DateTimeField(null=True, blank=True, verbose_name='Entregue em')
    cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name='Cancelado em')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-created_at']

    def __str__(self):
        return f"Pedido #{self.order_number}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self.generate_order_number()
        super().save(*args, **kwargs)

    @staticmethod
    def generate_order_number():
        """Gera um número único para o pedido"""
        prefix = timezone.now().strftime('%Y%m%d')
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"{prefix}-{suffix}"

    @property
    def total_items(self):
        return self.items.aggregate(total=models.Sum('quantity'))['total'] or 0

    @property
    def is_paid(self):
        return self.payment_transactions.filter(status='completed').exists()

    @property
    def can_be_cancelled(self):
        return self.status in ['pending', 'confirmed', 'processing']


class OrderItem(BaseModel):
    """Itens do pedido"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmado'),
        ('processing', 'Processando'),
        ('shipped', 'Enviado'),
        ('delivered', 'Entregue'),
        ('cancelled', 'Cancelado'),
        ('returned', 'Devolvido'),
        ('refunded', 'Reembolsado'),
    ]
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', verbose_name='Pedido')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, null=True, blank=True, verbose_name='Produto')
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, null=True, blank=True, verbose_name='Variante')
    
    # Snapshot dos dados no momento da compra
    product_name = models.CharField(max_length=300, verbose_name='Nome do Produto')
    product_sku = models.CharField(max_length=100, verbose_name='SKU do Produto')
    variant_attributes = models.JSONField(default=dict, blank=True, verbose_name='Atributos da Variante')
    
    # Quantidades e preços
    quantity = models.PositiveIntegerField(verbose_name='Quantidade')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Preço Unitário')
    total_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Preço Total')
    
    # Status específico do item
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending', verbose_name='Status')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Item do Pedido'
        verbose_name_plural = 'Itens do Pedido'
        ordering = ['id']

    def __str__(self):
        return f"{self.product_name} x{self.quantity} - {self.order.order_number}"

    def save(self, *args, **kwargs):
        if not self.total_price:
            self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)


class OrderStatusHistory(BaseModel):
    """Histórico de status dos pedidos"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history', verbose_name='Pedido')
    previous_status = models.CharField(max_length=50, blank=True, verbose_name='Status Anterior')
    new_status = models.CharField(max_length=50, verbose_name='Novo Status')
    comment = models.TextField(blank=True, verbose_name='Comentário')
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Usuário')  # Quem alterou
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    class Meta:
        verbose_name = 'Histórico de Status'
        verbose_name_plural = 'Histórico de Status'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order.order_number} - {self.previous_status} → {self.new_status}"
    
    
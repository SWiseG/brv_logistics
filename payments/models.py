from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid
from models.base import BaseModel
from orders.models import Order

User = get_user_model()


class PaymentMethod(BaseModel):
    """Métodos de pagamento"""
    TYPE_CHOICES = [
        ('credit_card', 'Cartão de Crédito'),
        ('debit_card', 'Cartão de Débito'),
        ('bank_transfer', 'Transferência Bancária'),
        ('pix', 'PIX'),
        ('boleto', 'Boleto Bancário'),
        ('digital_wallet', 'Carteira Digital'),
        ('cryptocurrency', 'Criptomoeda'),
    ]
    
    name = models.CharField(max_length=100, verbose_name='Nome')
    code = models.CharField(max_length=50, unique=True, verbose_name='Código')
    type = models.CharField(max_length=50, choices=TYPE_CHOICES, verbose_name='Tipo')
    provider = models.CharField(max_length=100, blank=True, verbose_name='Provedor')  # Mercado Pago, PagSeguro, etc.
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    sort_order = models.IntegerField(default=0, verbose_name='Ordem')
    configuration = models.JSONField(default=dict, blank=True, verbose_name='Configurações')  # Configurações específicas do método
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    class Meta:
        verbose_name = 'Método de Pagamento'
        verbose_name_plural = 'Métodos de Pagamento'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class PaymentTransaction(BaseModel):
    """Transações de pagamento"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('processing', 'Processando'),
        ('completed', 'Concluído'),
        ('failed', 'Falhou'),
        ('cancelled', 'Cancelado'),
        ('refunded', 'Reembolsado'),
        ('partially_refunded', 'Parcialmente Reembolsado'),
    ]
    
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payment_transactions', verbose_name='Pedido')
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT, verbose_name='Método de Pagamento')
    
    # Identificação externa
    external_id = models.CharField(max_length=200, blank=True, verbose_name='ID Externo')  # ID do gateway de pagamento
    reference = models.CharField(max_length=200, blank=True, verbose_name='Referência')  # Referência adicional
    
    # Valores
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Valor')
    fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Taxa')
    net_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Valor Líquido')
    currency = models.CharField(max_length=3, default='BRL', verbose_name='Moeda')
    
    # Status
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending', verbose_name='Status')
    
    # Detalhes do pagamento
    payment_details = models.JSONField(default=dict, blank=True, verbose_name='Detalhes do Pagamento')  # Dados específicos do método
    
    # Datas
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='Processado em')
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name='Expira em')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Transação de Pagamento'
        verbose_name_plural = 'Transações de Pagamento'
        ordering = ['-created_at']

    def __str__(self):
        return f"Transação #{self.id} - {self.order.order_number} - R$ {self.amount}"

    def save(self, *args, **kwargs):
        if not self.net_amount:
            self.net_amount = self.amount - self.fee_amount
        super().save(*args, **kwargs)

    @property
    def is_successful(self):
        return self.status == 'completed'

    @property
    def is_refundable(self):
        return self.status in ['completed', 'partially_refunded']


class PaymentTransactionHistory(BaseModel):
    """Histórico de transações"""
    transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='history', verbose_name='Transação')
    previous_status = models.CharField(max_length=50, blank=True, verbose_name='Status Anterior')
    new_status = models.CharField(max_length=50, verbose_name='Novo Status')
    response_data = models.JSONField(default=dict, blank=True, verbose_name='Dados de Resposta')
    notes = models.TextField(blank=True, verbose_name='Observações')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    class Meta:
        verbose_name = 'Histórico de Transação'
        verbose_name_plural = 'Histórico de Transações'
        ordering = ['-created_at']

    def __str__(self):
        return f"Transação #{self.transaction.id} - {self.previous_status} → {self.new_status}"


class UserPaymentCard(BaseModel):
    """Cartões salvos dos usuários"""
    BRAND_CHOICES = [
        ('visa', 'Visa'),
        ('mastercard', 'Mastercard'),
        ('amex', 'American Express'),
        ('elo', 'Elo'),
        ('hipercard', 'Hipercard'),
        ('diners', 'Diners Club'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_cards', verbose_name='Usuário')
    
    # Dados do cartão (tokenizados)
    token = models.CharField(max_length=200, verbose_name='Token')  # Token do gateway
    last_four = models.CharField(max_length=4, verbose_name='Últimos 4 Dígitos')
    brand = models.CharField(max_length=50, choices=BRAND_CHOICES, verbose_name='Bandeira')
    exp_month = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)], verbose_name='Mês de Expiração')
    exp_year = models.IntegerField(verbose_name='Ano de Expiração')
    holder_name = models.CharField(max_length=200, blank=True, verbose_name='Nome do Portador')
    
    # Status
    is_default = models.BooleanField(default=False, verbose_name='Padrão')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Cartão do Usuário'
        verbose_name_plural = 'Cartões dos Usuários'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.get_brand_display()} **** {self.last_four} - {self.user.get_full_name()}"

    @property
    def is_expired(self):
        from datetime import date
        today = date.today()
        return today.year > self.exp_year or (today.year == self.exp_year and today.month > self.exp_month)

    @property
    def masked_number(self):
        return f"**** **** **** {self.last_four}"
    """Cartões salvos dos usuários"""
    CARD_BRANDS = [
        ('visa', 'Visa'),
        ('mastercard', 'Mastercard'),
        ('amex', 'American Express'),
        ('elo', 'Elo'),
        ('hipercard', 'Hipercard'),
    ]
    
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='payment_cards')
    
    # Dados do cartão (tokenizados)
    token = models.CharField('Token', max_length=200)  # Token do gateway
    last_four = models.CharField('Últimos 4 Dígitos', max_length=4)
    brand = models.CharField('Bandeira', max_length=50, choices=CARD_BRANDS)
    exp_month = models.PositiveIntegerField('Mês de Expiração')
    exp_year = models.PositiveIntegerField('Ano de Expiração')
    holder_name = models.CharField('Nome do Portador', max_length=200)
    
    # Status
    is_default = models.BooleanField('Padrão', default=False)
    is_active = models.BooleanField('Ativo', default=True)
    
    class Meta:
        verbose_name = 'Cartão de Pagamento'
        verbose_name_plural = 'Cartões de Pagamento'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'is_default'], 
                condition=models.Q(is_default=True, is_deleted=False),
                name='unique_default_card_per_user'
            )
        ]
    
    def __str__(self):
        return f"{self.brand.title()} ****{self.last_four}"
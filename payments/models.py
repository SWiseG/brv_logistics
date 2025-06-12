from django.db import models
from django.contrib.postgres.fields import JSONField
from django.contrib.postgres.indexes import GinIndex
from models.base import BaseModel
from models.validators import validate_positive_price

class PaymentMethod(BaseModel):
    """Métodos de pagamento disponíveis"""
    PAYMENT_TYPES = [
        ('credit_card', 'Cartão de Crédito'),
        ('debit_card', 'Cartão de Débito'),
        ('bank_transfer', 'Transferência Bancária'),
        ('pix', 'PIX'),
        ('boleto', 'Boleto Bancário'),
        ('digital_wallet', 'Carteira Digital'),
        ('cryptocurrency', 'Criptomoeda'),
    ]
    
    name = models.CharField('Nome', max_length=100)
    code = models.CharField('Código', max_length=50, unique=True)
    type = models.CharField('Tipo', max_length=50, choices=PAYMENT_TYPES)
    provider = models.CharField('Provedor', max_length=100, blank=True)  # Mercado Pago, PagSeguro, etc.
    is_active = models.BooleanField('Ativo', default=True)
    sort_order = models.PositiveIntegerField('Ordem', default=0)
    configuration = JSONField('Configurações', default=dict, blank=True)
    
    # Configurações de taxa
    fee_percentage = models.DecimalField('Taxa (%)', max_digits=5, decimal_places=2, default=0)
    fee_fixed = models.DecimalField('Taxa Fixa', max_digits=10, decimal_places=2, default=0)
    
    class Meta:
        verbose_name = 'Método de Pagamento'
        verbose_name_plural = 'Métodos de Pagamento'
        indexes = [
            models.Index(fields=['type']),
            models.Index(fields=['is_active', 'sort_order']),
            GinIndex(fields=['configuration']),
        ]
    
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
    
    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='payment_transactions')
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.SET_NULL, null=True)
    
    # Identificação externa
    external_id = models.CharField('ID Externo', max_length=200, blank=True)
    reference = models.CharField('Referência', max_length=200, blank=True)
    
    # Valores
    amount = models.DecimalField('Valor', max_digits=10, decimal_places=2, validators=[validate_positive_price])
    fee_amount = models.DecimalField('Taxa', max_digits=10, decimal_places=2, default=0)
    net_amount = models.DecimalField('Valor Líquido', max_digits=10, decimal_places=2)
    currency = models.CharField('Moeda', max_length=3, default='BRL')
    
    # Status
    status = models.CharField('Status', max_length=50, choices=STATUS_CHOICES, default='pending')
    
    # Detalhes do pagamento
    payment_details = JSONField('Detalhes do Pagamento', default=dict, blank=True)
    
    # Datas
    processed_at = models.DateTimeField('Processado em', null=True, blank=True)
    expires_at = models.DateTimeField('Expira em', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Transação de Pagamento'
        verbose_name_plural = 'Transações de Pagamento'
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['status']),
            models.Index(fields=['external_id']),
            models.Index(fields=['processed_at']),
            GinIndex(fields=['payment_details']),
        ]
    
    def __str__(self):
        return f"Transação {self.uuid} - {self.status}"

class PaymentTransactionHistory(models.Model):
    """Histórico de transações"""
    transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='history')
    previous_status = models.CharField('Status Anterior', max_length=50, blank=True)
    new_status = models.CharField('Novo Status', max_length=50)
    response_data = JSONField('Dados da Resposta', default=dict, blank=True)
    notes = models.TextField('Observações', blank=True)
    created_at = models.DateTimeField('Criado em', auto_now_add=True)

class UserPaymentCard(BaseModel):
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
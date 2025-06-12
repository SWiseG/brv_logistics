from django.db import models
from django.contrib.postgres.fields import JSONField
from django.contrib.postgres.indexes import GinIndex
from models.base import BaseModel, AddressMixin
from models.validators import validate_positive_price

class Warehouse(BaseModel, AddressMixin):
    """Depósitos/Armazéns"""
    name = models.CharField('Nome', max_length=200)
    code = models.CharField('Código', max_length=50, unique=True)
    phone = models.CharField('Telefone', max_length=20, blank=True)
    email = models.EmailField('Email', blank=True)
    manager_name = models.CharField('Gerente', max_length=200, blank=True)
    is_active = models.BooleanField('Ativo', default=True)
    is_default = models.BooleanField('Padrão', default=False)
    
    # Configurações operacionais
    operating_hours = JSONField('Horário de Funcionamento', default=dict, blank=True)
    capacity_info = JSONField('Informações de Capacidade', default=dict, blank=True)
    
    class Meta:
        verbose_name = 'Depósito'
        verbose_name_plural = 'Depósitos'
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['is_active']),
            GinIndex(fields=['operating_hours']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['is_default'], 
                condition=models.Q(is_default=True, is_deleted=False),
                name='unique_default_warehouse'
            )
        ]
    
    def __str__(self):
        return self.name

class InventoryItem(BaseModel):
    """Estoque por produto/variante e depósito"""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='inventory_items')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.CASCADE, null=True, blank=True)
    
    # Quantidades
    quantity_available = models.PositiveIntegerField('Quantidade Disponível', default=0)
    quantity_reserved = models.PositiveIntegerField('Quantidade Reservada', default=0)
    quantity_on_order = models.PositiveIntegerField('Quantidade em Pedido', default=0)
    
    # Níveis de controle
    reorder_point = models.PositiveIntegerField('Ponto de Reposição', default=0)
    reorder_quantity = models.PositiveIntegerField('Quantidade de Reposição', default=0)
    max_stock_level = models.PositiveIntegerField('Nível Máximo de Estoque', null=True, blank=True)
    
    # Localização física
    bin_location = models.CharField('Localização', max_length=50, blank=True)
    
    # Custos
    unit_cost = models.DecimalField('Custo Unitário', max_digits=10, decimal_places=2, validators=[validate_positive_price])
    last_cost = models.DecimalField('Último Custo', max_digits=10, decimal_places=2, null=True, blank=True)
    average_cost = models.DecimalField('Custo Médio', max_digits=10, decimal_places=2, null=True, blank=True)
    
    class Meta:
        verbose_name = 'Item de Estoque'
        verbose_name_plural = 'Itens de Estoque'
        unique_together = ['warehouse', 'product', 'variant']
        indexes = [
            models.Index(fields=['warehouse', 'product']),
            models.Index(fields=['quantity_available']),
            models.Index(fields=['reorder_point']),
        ]
    
    def __str__(self):
        variant_name = f" - {self.variant.name}" if self.variant else ""
        return f"{self.product.name}{variant_name} ({self.warehouse.name})"
    
    @property
    def total_quantity(self):
        return self.quantity_available + self.quantity_reserved
    
    @property
    def needs_reorder(self):
        return self.quantity_available <= self.reorder_point

class InventoryMovement(models.Model):
    """Movimentações de estoque (auditoria completa)"""
    MOVEMENT_TYPES = [
        ('purchase', 'Compra'),
        ('sale', 'Venda'),
        ('return', 'Devolução'),
        ('adjustment', 'Ajuste'),
        ('transfer_in', 'Transferência Entrada'),
        ('transfer_out', 'Transferência Saída'),
        ('damage', 'Avaria'),
        ('expired', 'Vencido'),
        ('promotional', 'Promocional'),
        ('reserved', 'Reservado'),
        ('released', 'Liberado'),
    ]
    
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField('Tipo de Movimentação', max_length=50, choices=MOVEMENT_TYPES)
    reference_type = models.CharField('Tipo de Referência', max_length=50, blank=True)
    reference_id = models.PositiveIntegerField('ID da Referência', null=True, blank=True)
    
    # Quantidades
    quantity_before = models.IntegerField('Quantidade Anterior')
    quantity_change = models.IntegerField('Mudança de Quantidade')
    quantity_after = models.IntegerField('Quantidade Posterior')
    
    # Detalhes
    unit_cost = models.DecimalField('Custo Unitário', max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField('Observações', blank=True)
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField('Criado em', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Movimentação de Estoque'
        verbose_name_plural = 'Movimentações de Estoque'
        indexes = [
            models.Index(fields=['inventory_item', 'created_at']),
            models.Index(fields=['movement_type']),
            models.Index(fields=['reference_type', 'reference_id']),
        ]

class InventoryTransfer(BaseModel):
    """Transferências entre depósitos"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('in_transit', 'Em Trânsito'),
        ('completed', 'Concluído'),
        ('cancelled', 'Cancelado'),
    ]
    
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='transfers_out')
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='transfers_in')
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField('Observações', blank=True)
    requested_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='requested_transfers')
    approved_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_transfers')
    shipped_at = models.DateTimeField('Enviado em', null=True, blank=True)
    received_at = models.DateTimeField('Recebido em', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Transferência de Estoque'
        verbose_name_plural = 'Transferências de Estoque'

class InventoryTransferItem(models.Model):
    """Itens da transferência"""
    transfer = models.ForeignKey(InventoryTransfer, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.CASCADE, null=True, blank=True)
    quantity_requested = models.PositiveIntegerField('Quantidade Solicitada')
    quantity_shipped = models.PositiveIntegerField('Quantidade Enviada', default=0)
    quantity_received = models.PositiveIntegerField('Quantidade Recebida', default=0)
    notes = models.TextField('Observações', blank=True)
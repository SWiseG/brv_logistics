
# -*- coding: utf-8 -*-
from django.db import models
from django.contrib.auth import get_user_model

from models.base import BaseModel

User = get_user_model()


class Warehouse(BaseModel):
    """Depósitos/Armazéns"""
    name = models.CharField(max_length=200, verbose_name='Nome')
    code = models.CharField(max_length=50, unique=True, verbose_name='Código')
    address_line_1 = models.CharField(max_length=255, blank=True, verbose_name='Endereço')
    address_line_2 = models.CharField(max_length=255, blank=True, verbose_name='Complemento')
    city = models.CharField(max_length=100, blank=True, verbose_name='Cidade')
    state = models.CharField(max_length=100, blank=True, verbose_name='Estado')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='CEP')
    country = models.CharField(max_length=100, blank=True, verbose_name='País')
    phone = models.CharField(max_length=20, blank=True, verbose_name='Telefone')
    email = models.EmailField(blank=True, verbose_name='E-mail')
    manager_name = models.CharField(max_length=200, blank=True, verbose_name='Nome do Gerente')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_default = models.BooleanField(default=False, verbose_name='Padrão')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Depósito'
        verbose_name_plural = 'Depósitos'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class InventoryItem(BaseModel):
    """Estoque por produto/variante e depósito"""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='inventory_items', verbose_name='Depósito')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='inventory_items', verbose_name='Produto')
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.CASCADE, null=True, blank=True, related_name='inventory_items', verbose_name='Variante')
    
    # Quantidades
    quantity_available = models.IntegerField(default=0, verbose_name='Quantidade Disponível')
    quantity_reserved = models.IntegerField(default=0, verbose_name='Quantidade Reservada')
    quantity_on_order = models.IntegerField(default=0, verbose_name='Quantidade em Pedido')
    
    # Níveis de controle
    reorder_point = models.IntegerField(default=0, verbose_name='Ponto de Reposição')
    reorder_quantity = models.IntegerField(default=0, verbose_name='Quantidade de Reposição')
    max_stock_level = models.IntegerField(null=True, blank=True, verbose_name='Nível Máximo de Estoque')
    
    # Localização física
    bin_location = models.CharField(max_length=50, blank=True, verbose_name='Localização')
    
    # Custos
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Custo Unitário')
    last_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Último Custo')
    average_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Custo Médio')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Item de Estoque'
        verbose_name_plural = 'Itens de Estoque'
        unique_together = ['warehouse', 'product', 'variant']
        ordering = ['warehouse', 'product']

    def __str__(self):
        product_name = self.variant.product.name if self.variant else self.product.name
        return f"{product_name} - {self.warehouse.name} ({self.quantity_available})"

    @property
    def total_quantity(self):
        return self.quantity_available + self.quantity_reserved

    @property
    def needs_reorder(self):
        return self.quantity_available <= self.reorder_point


class InventoryMovement(BaseModel):
    """Movimentações de estoque (auditoria completa)"""
    MOVEMENT_TYPES = [
        ('purchase', 'Compra'),
        ('sale', 'Venda'),
        ('return', 'Devolução'),
        ('adjustment', 'Ajuste'),
        ('transfer_in', 'Transferência Entrada'),
        ('transfer_out', 'Transferência Saída'),
        ('damage', 'Dano'),
        ('expired', 'Expirado'),
        ('promotional', 'Promocional'),
        ('reserved', 'Reservado'),
        ('released', 'Liberado'),
    ]
    
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements', verbose_name='Item de Estoque')
    movement_type = models.CharField(max_length=50, choices=MOVEMENT_TYPES, verbose_name='Tipo de Movimentação')
    reference_type = models.CharField(max_length=50, blank=True, verbose_name='Tipo de Referência')  # order, purchase_order, transfer, etc.
    reference_id = models.IntegerField(null=True, blank=True, verbose_name='ID de Referência')
    
    # Quantidades
    quantity_before = models.IntegerField(verbose_name='Quantidade Anterior')
    quantity_change = models.IntegerField(verbose_name='Alteração de Quantidade')  # Pode ser negativo
    quantity_after = models.IntegerField(verbose_name='Quantidade Posterior')
    
    # Detalhes
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Custo Unitário')
    notes = models.TextField(blank=True, verbose_name='Observações')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Usuário')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    class Meta:
        verbose_name = 'Movimentação de Estoque'
        verbose_name_plural = 'Movimentações de Estoque'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_movement_type_display()} - {self.inventory_item} ({self.quantity_change:+d})"


class InventoryTransfer(BaseModel):
    """Transferências entre depósitos"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('in_transit', 'Em Trânsito'),
        ('completed', 'Concluído'),
        ('cancelled', 'Cancelado'),
    ]
    
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='transfers_from', verbose_name='Depósito de Origem')
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='transfers_to', verbose_name='Depósito de Destino')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='Status')
    notes = models.TextField(blank=True, verbose_name='Observações')
    requested_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='requested_transfers', verbose_name='Solicitado por')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_transfers', verbose_name='Aprovado por')
    shipped_at = models.DateTimeField(null=True, blank=True, verbose_name='Enviado em')
    received_at = models.DateTimeField(null=True, blank=True, verbose_name='Recebido em')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Transferência de Estoque'
        verbose_name_plural = 'Transferências de Estoque'
        ordering = ['-created_at']

    def __str__(self):
        return f"Transferência #{self.id} - {self.from_warehouse} → {self.to_warehouse}"


class InventoryTransferItem(BaseModel):
    """Itens da transferência"""
    transfer = models.ForeignKey(InventoryTransfer, on_delete=models.CASCADE, related_name='items', verbose_name='Transferência')
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT, verbose_name='Produto')
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.PROTECT, null=True, blank=True, verbose_name='Variante')
    quantity_requested = models.IntegerField(verbose_name='Quantidade Solicitada')
    quantity_shipped = models.IntegerField(default=0, verbose_name='Quantidade Enviada')
    quantity_received = models.IntegerField(default=0, verbose_name='Quantidade Recebida')
    notes = models.TextField(blank=True, verbose_name='Observações')

    class Meta:
        verbose_name = 'Item de Transferência'
        verbose_name_plural = 'Itens de Transferência'

    def __str__(self):
        product_name = self.variant.product.name if self.variant else self.product.name
        return f"{product_name} - {self.quantity_requested}"
                
from django.db import models
from django.contrib.postgres.fields import JSONField
from django.contrib.postgres.indexes import GinIndex
from models.base import BaseModel
from models.validators import validate_positive_price

class ShippingMethod(BaseModel):
    """Métodos de envio disponíveis"""
    CALCULATION_METHODS = [
        ('fixed', 'Preço Fixo'),
        ('weight_based', 'Baseado no Peso'),
        ('zone_based', 'Baseado na Zona'),
        ('api_based', 'API da Transportadora'),
    ]
    
    name = models.CharField('Nome', max_length=200)
    code = models.CharField('Código', max_length=50, unique=True)
    carrier = models.CharField('Transportadora', max_length=100, blank=True)  # Correios, Total Express, etc.
    description = models.TextField('Descrição', blank=True)
    
    # Configurações
    is_active = models.BooleanField('Ativo', default=True)
    sort_order = models.PositiveIntegerField('Ordem', default=0)
    calculation_method = models.CharField('Método de Cálculo', max_length=50, choices=CALCULATION_METHODS, default='fixed')
    
    # Preços e limites
    base_price = models.DecimalField('Preço Base', max_digits=10, decimal_places=2, default=0)
    price_per_kg = models.DecimalField('Preço por Kg', max_digits=10, decimal_places=2, default=0)
    free_shipping_threshold = models.DecimalField('Frete Grátis a partir de', max_digits=10, decimal_places=2, null=True, blank=True)
    min_weight = models.DecimalField('Peso Mínimo', max_digits=8, decimal_places=3, null=True, blank=True)
    max_weight = models.DecimalField('Peso Máximo', max_digits=8, decimal_places=3, null=True, blank=True)
    
    # Tempos
    min_delivery_days = models.PositiveIntegerField('Dias Mínimos para Entrega', default=1)
    max_delivery_days = models.PositiveIntegerField('Dias Máximos para Entrega', default=30)
    
    # Configurações adicionais
    configuration = JSONField('Configurações', default=dict, blank=True)
    
    class Meta:
        verbose_name = 'Método de Envio'
        verbose_name_plural = 'Métodos de Envio'
        indexes = [
            models.Index(fields=['is_active', 'sort_order']),
            models.Index(fields=['carrier']),
            GinIndex(fields=['configuration']),
        ]
    
    def __str__(self):
        return self.name

class ShippingZone(BaseModel):
    """Zonas de envio"""
    name = models.CharField('Nome', max_length=200)
    description = models.TextField('Descrição', blank=True)
    is_active = models.BooleanField('Ativa', default=True)
    
    class Meta:
        verbose_name = 'Zona de Envio'
        verbose_name_plural = 'Zonas de Envio'
    
    def __str__(self):
        return self.name

class ShippingZoneRegion(models.Model):
    """Regiões das zonas (Estados, CEPs, etc.)"""
    REGION_TYPES = [
        ('state', 'Estado'),
        ('postal_code', 'Faixa de CEP'),
        ('city', 'Cidade'),
    ]
    
    zone = models.ForeignKey(ShippingZone, on_delete=models.CASCADE, related_name='regions')
    type = models.CharField('Tipo', max_length=20, choices=REGION_TYPES)
    value = models.CharField('Valor', max_length=100)  # Código do estado, faixa de CEP, etc.
    created_at = models.DateTimeField('Criado em', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Região da Zona'
        verbose_name_plural = 'Regiões das Zonas'
        unique_together = ['zone', 'type', 'value']

class ShippingZoneRate(models.Model):
    """Preços por zona"""
    zone = models.ForeignKey(ShippingZone, on_delete=models.CASCADE, related_name='rates')
    method = models.ForeignKey(ShippingMethod, on_delete=models.CASCADE, related_name='zone_rates')
    min_weight = models.DecimalField('Peso Mínimo', max_digits=8, decimal_places=3, default=0)
    max_weight = models.DecimalField('Peso Máximo', max_digits=8, decimal_places=3, null=True, blank=True)
    price = models.DecimalField('Preço', max_digits=10, decimal_places=2, validators=[validate_positive_price])
    additional_kg_price = models.DecimalField('Preço por Kg Adicional', max_digits=10, decimal_places=2, default=0)
    
    class Meta:
        verbose_name = 'Taxa da Zona'
        verbose_name_plural = 'Taxas das Zonas'
        unique_together = ['zone', 'method', 'min_weight']

class Shipment(BaseModel):
    """Envios/Remessas"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('ready_to_ship', 'Pronto para Envio'),
        ('shipped', 'Enviado'),
        ('in_transit', 'Em Trânsito'),
        ('out_for_delivery', 'Saiu para Entrega'),
        ('delivered', 'Entregue'),
        ('failed_delivery', 'Falha na Entrega'),
        ('returned', 'Devolvido'),
    ]
    
    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='shipments')
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)
    shipping_method = models.ForeignKey(ShippingMethod, on_delete=models.SET_NULL, null=True)
    
    # Identificação
    tracking_number = models.CharField('Código de Rastreamento', max_length=200, blank=True)
    carrier_reference = models.CharField('Referência da Transportadora', max_length=200, blank=True)
    
    # Status
    status = models.CharField('Status', max_length=50, choices=STATUS_CHOICES, default='pending')
    
    # Endereço de entrega (snapshot)
    shipping_address = JSONField('Endereço de Entrega')
    
    # Dimensões e peso
    weight = models.DecimalField('Peso', max_digits=8, decimal_places=3, null=True, blank=True)
    length = models.DecimalField('Comprimento', max_digits=8, decimal_places=2, null=True, blank=True)
    width = models.DecimalField('Largura', max_digits=8, decimal_places=2, null=True, blank=True)
    height = models.DecimalField('Altura', max_digits=8, decimal_places=2, null=True, blank=True)
    
    # Custos
    shipping_cost = models.DecimalField('Custo do Envio', max_digits=10, decimal_places=2, null=True, blank=True)
    insurance_cost = models.DecimalField('Custo do Seguro', max_digits=10, decimal_places=2, default=0)
    
    # Datas
    shipped_at = models.DateTimeField('Enviado em', null=True, blank=True)
    estimated_delivery = models.DateTimeField('Entrega Estimada', null=True, blank=True)
    delivered_at = models.DateTimeField('Entregue em', null=True, blank=True)
    
    # Tracking
    tracking_events = JSONField('Eventos de Rastreamento', default=list, blank=True)
    
    class Meta:
        verbose_name = 'Envio'
        verbose_name_plural = 'Envios'
        indexes = [
            models.Index(fields=['tracking_number']),
            models.Index(fields=['status']),
            models.Index(fields=['shipped_at']),
            GinIndex(fields=['shipping_address']),
            GinIndex(fields=['tracking_events']),
        ]
    
    def __str__(self):
        return f"Envio {self.uuid} - {self.status}"

class ShipmentItem(models.Model):
    """Itens do envio"""
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='items')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField('Quantidade')
    created_at = models.DateTimeField('Criado em', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Item do Envio'
        verbose_name_plural = 'Itens dos Envios'
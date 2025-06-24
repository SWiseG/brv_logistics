from django.db import models
from models.base import BaseModel
from django.core.validators import MinValueValidator, MaxValueValidator
from models.validators import validate_positive_price
from django.contrib.auth import get_user_model

User = get_user_model()

class Supplier(BaseModel):
    """Fornecedores"""
    id = models.BigAutoField(primary_key=True)
    company_name = models.CharField(max_length=200, verbose_name='Nome da Empresa')
    contact_name = models.CharField(max_length=200, blank=True, verbose_name='Nome do Contato')
    email = models.EmailField(blank=True, verbose_name='E-mail')
    phone = models.CharField(max_length=20, blank=True, verbose_name='Telefone')
    website = models.URLField(blank=True, verbose_name='Website')
    address_line_1 = models.CharField(max_length=255, blank=True, verbose_name='Endereço')
    address_line_2 = models.CharField(max_length=255, blank=True, verbose_name='Complemento')
    city = models.CharField(max_length=100, blank=True, verbose_name='Cidade')
    state = models.CharField(max_length=100, blank=True, verbose_name='Estado')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='CEP')
    country = models.CharField(max_length=100, blank=True, verbose_name='País')
    tax_id = models.CharField(max_length=50, blank=True, verbose_name='CNPJ/CPF')
    payment_terms = models.IntegerField(default=30, verbose_name='Prazo de Pagamento (dias)')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00, validators=[MinValueValidator(0), MaxValueValidator(5)], verbose_name='Avaliação')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    class Meta:
        verbose_name = 'Fornecedor'
        verbose_name_plural = 'Fornecedores'
        indexes = [
            models.Index(fields=['company_name']),
            models.Index(fields=['tax_id']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.trade_name or self.company_name

class PurchaseOrder(BaseModel):
    """Pedidos de compra"""
    STATUS_CHOICES = [
        ('draft', 'Rascunho'),
        ('sent', 'Enviado'),
        ('confirmed', 'Confirmado'),
        ('partially_received', 'Parcialmente Recebido'),
        ('received', 'Recebido'),
        ('cancelled', 'Cancelado'),
    ]
    
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='purchase_orders')
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='purchase_orders')
    
    # Identificação
    po_number = models.CharField('Número do PO', max_length=50, unique=True)
    supplier_reference = models.CharField('Referência do Fornecedor', max_length=100, blank=True)
    
    # Status
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Valores
    subtotal = models.DecimalField('Subtotal', max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField('Impostos', max_digits=12, decimal_places=2, default=0)
    shipping_amount = models.DecimalField('Frete', max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField('Desconto', max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField('Total', max_digits=12, decimal_places=2, default=0)
    
    # Datas
    order_date = models.DateField('Data do Pedido', auto_now_add=True)
    expected_delivery = models.DateField('Entrega Prevista', null=True, blank=True)
    delivered_at = models.DateTimeField('Entregue em', null=True, blank=True)
    
    # Informações adicionais
    notes = models.TextField('Observações', blank=True)
    terms_and_conditions = models.TextField('Termos e Condições', blank=True)
    
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='created_purchase_orders')
    approved_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_purchase_orders')
    
    class Meta:
        verbose_name = 'Pedido de Compra'
        verbose_name_plural = 'Pedidos de Compra'
        indexes = [
            models.Index(fields=['supplier', 'status']),
            models.Index(fields=['order_date']),
            models.Index(fields=['expected_delivery']),
        ]
    
    def __str__(self):
        return f"PO {self.po_number} - {self.supplier.company_name}"

class PurchaseOrderItem(BaseModel):
    """Itens do pedido de compra"""
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.CASCADE, null=True, blank=True)
    
    # Quantidades
    quantity_ordered = models.PositiveIntegerField('Quantidade Pedida')
    quantity_received = models.PositiveIntegerField('Quantidade Recebida', default=0)
    
    # Preços
    unit_cost = models.DecimalField('Custo Unitário', max_digits=10, decimal_places=2, validators=[validate_positive_price])
    total_cost = models.DecimalField('Custo Total', max_digits=12, decimal_places=2)
    
    # Snapshot dos dados do produto
    product_name = models.CharField('Nome do Produto', max_length=300)
    product_sku = models.CharField('SKU', max_length=100)
    
    # Datas
    expected_delivery = models.DateField('Entrega Prevista', null=True, blank=True)
    received_at = models.DateTimeField('Recebido em', null=True, blank=True)
    
    notes = models.TextField('Observações', blank=True)
    
    class Meta:
        verbose_name = 'Item do Pedido de Compra'
        verbose_name_plural = 'Itens dos Pedidos de Compra'
    
    def save(self, *args, **kwargs):
        self.total_cost = self.quantity_ordered * self.unit_cost
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.product_name} ({self.quantity_ordered})"
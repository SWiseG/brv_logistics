from django.db import models
from django.contrib.postgres.fields import JSONField
from django.contrib.postgres.indexes import GinIndex
from models.base import BaseModel

class AnalyticsEvent(models.Model):
    """Eventos de analytics"""
    EVENT_TYPES = [
        ('page_view', 'Visualização de Página'),
        ('product_view', 'Visualização de Produto'),
        ('add_to_cart', 'Adicionar ao Carrinho'),
        ('remove_from_cart', 'Remover do Carrinho'),
        ('add_to_wishlist', 'Adicionar à Wishlist'),
        ('purchase', 'Compra'),
        ('search', 'Busca'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('registration', 'Cadastro'),
    ]
    
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True)
    session_id = models.CharField('ID da Sessão', max_length=100, blank=True)
    event_type = models.CharField('Tipo de Evento', max_length=100, choices=EVENT_TYPES)
    event_data = JSONField('Dados do Evento', default=dict, blank=True)
    
    # Informações da sessão
    ip_address = models.GenericIPAddressField('Endereço IP', null=True, blank=True)
    user_agent = models.TextField('User Agent', blank=True)
    referrer = models.URLField('Referrer', max_length=500, blank=True)
    page_url = models.URLField('URL da Página', max_length=500, blank=True)
    
    created_at = models.DateTimeField('Criado em', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Evento de Analytics'
        verbose_name_plural = 'Eventos de Analytics'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['session_id', 'created_at']),
            models.Index(fields=['event_type', 'created_at']),
            GinIndex(fields=['event_data']),
        ]

class SalesReport(models.Model):
    """Relatórios de vendas (pré-calculados para performance)"""
    PERIOD_TYPES = [
        ('daily', 'Diário'),
        ('weekly', 'Semanal'),
        ('monthly', 'Mensal'),
        ('yearly', 'Anual'),
    ]
    
    report_date = models.DateField('Data do Relatório')
    period_type = models.CharField('Tipo de Período', max_length=20, choices=PERIOD_TYPES)
    
    # Métricas principais
    total_orders = models.PositiveIntegerField('Total de Pedidos', default=0)
    total_revenue = models.DecimalField('Receita Total', max_digits=12, decimal_places=2, default=0)
    total_items_sold = models.PositiveIntegerField('Total de Itens Vendidos', default=0)
    average_order_value = models.DecimalField('Valor Médio do Pedido', max_digits=10, decimal_places=2, default=0)
    
    # Quebras detalhadas
    category_breakdown = JSONField('Breakdown por Categoria', default=dict, blank=True)
    payment_method_breakdown = JSONField('Breakdown por Método de Pagamento', default=dict, blank=True)
    geographic_breakdown = JSONField('Breakdown Geográfico', default=dict, blank=True)
    
    created_at = models.DateTimeField('Criado em', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Relatório de Vendas'
        verbose_name_plural = 'Relatórios de Vendas'
        unique_together = ['report_date', 'period_type']
        indexes = [
            models.Index(fields=['report_date', 'period_type']),
            GinIndex(fields=['category_breakdown']),
            GinIndex(fields=['payment_method_breakdown']),
        ]

class ProductPerformance(models.Model):
    """Performance de produtos (cache para melhor performance)"""
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='performance_metrics')
    date = models.DateField('Data')
    
    # Métricas de visualização
    views_count = models.PositiveIntegerField('Visualizações', default=0)
    unique_views_count = models.PositiveIntegerField('Visualizações Únicas', default=0)
    
    # Métricas de conversão
    add_to_cart_count = models.PositiveIntegerField('Adições ao Carrinho', default=0)
    purchase_count = models.PositiveIntegerField('Compras', default=0)
    revenue = models.DecimalField('Receita', max_digits=12, decimal_places=2, default=0)
    
    # Métricas calculadas
    conversion_rate = models.DecimalField('Taxa de Conversão', max_digits=5, decimal_places=2, default=0)
    cart_conversion_rate = models.DecimalField('Taxa de Conversão do Carrinho', max_digits=5, decimal_places=2, default=0)
    
    # Avaliações
    average_rating = models.DecimalField('Avaliação Média', max_digits=3, decimal_places=2, null=True, blank=True)
    reviews_count = models.PositiveIntegerField('Número de Avaliações', default=0)
    
    class Meta:
        verbose_name = 'Performance do Produto'
        verbose_name_plural = 'Performance dos Produtos'
        unique_together = ['product', 'date']
        indexes = [
            models.Index(fields=['product', 'date']),
            models.Index(fields=['date', 'views_count']),
            models.Index(fields=['date', 'revenue']),
        ]

class CustomerMetrics(BaseModel):
    """Métricas de clientes"""
    user = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='metrics')
    
    # Métricas de compra
    total_orders = models.PositiveIntegerField('Total de Pedidos', default=0)
    total_spent = models.DecimalField('Total Gasto', max_digits=12, decimal_places=2, default=0)
    average_order_value = models.DecimalField('Valor Médio do Pedido', max_digits=10, decimal_places=2, default=0)
    
    # Métricas de engajamento
    last_purchase_date = models.DateTimeField('Última Compra', null=True, blank=True)
    days_since_last_purchase = models.PositiveIntegerField('Dias desde a Última Compra', null=True, blank=True)
    
    # Classificação
    customer_tier = models.CharField('Categoria do Cliente', max_length=20, choices=[
        ('bronze', 'Bronze'),
        ('silver', 'Prata'),
        ('gold', 'Ouro'),
        ('platinum', 'Platina'),
    ], default='bronze')
    
    # Preferências identificadas
    preferred_categories = JSONField('Categorias Preferidas', default=list, blank=True)
    preferred_payment_method = models.CharField('Método de Pagamento Preferido', max_length=50, blank=True)
    
    class Meta:
        verbose_name = 'Métricas do Cliente'
        verbose_name_plural = 'Métricas dos Clientes'
        indexes = [
            models.Index(fields=['customer_tier']),
            models.Index(fields=['total_spent']),
            models.Index(fields=['last_purchase_date']),
        ]
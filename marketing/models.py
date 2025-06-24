from django.db import models
from django.db.models import JSONField
from django.contrib.postgres.indexes import GinIndex
from models.base import BaseModel

class EmailCampaign(BaseModel):
    """Campanhas de email marketing"""
    TARGET_AUDIENCES = [
        ('all', 'Todos'),
        ('customers', 'Clientes'),
        ('prospects', 'Prospects'),
        ('custom_segment', 'Segmento Customizado'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Rascunho'),
        ('scheduled', 'Agendado'),
        ('sending', 'Enviando'),
        ('sent', 'Enviado'),
        ('paused', 'Pausado'),
        ('cancelled', 'Cancelado'),
    ]
    
    name = models.CharField('Nome', max_length=200)
    subject = models.CharField('Assunto', max_length=300)
    template_id = models.CharField('ID do Template', max_length=100, blank=True)
    content = models.TextField('Conteúdo', blank=True)
    
    # Segmentação
    target_audience = models.CharField('Público Alvo', max_length=50, choices=TARGET_AUDIENCES, default='all')
    segment_filters = JSONField('Filtros de Segmento', default=dict, blank=True)
    
    # Status
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Estatísticas
    total_recipients = models.PositiveIntegerField('Total de Destinatários', default=0)
    sent_count = models.PositiveIntegerField('Enviados', default=0)
    opened_count = models.PositiveIntegerField('Abertos', default=0)
    clicked_count = models.PositiveIntegerField('Cliques', default=0)
    bounced_count = models.PositiveIntegerField('Rejeitados', default=0)
    
    # Datas
    scheduled_at = models.DateTimeField('Agendado para', null=True, blank=True)
    sent_at = models.DateTimeField('Enviado em', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Campanha de Email'
        verbose_name_plural = 'Campanhas de Email'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['target_audience']),
            GinIndex(fields=['segment_filters']),
        ]
    
    def __str__(self):
        return self.name


class Coupon(BaseModel):
    code = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    discount_type = models.CharField(max_length=10, choices=[('percentage', 'Porcentagem'), ('fixed', 'Valor Fixo')])
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    minimum_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    usage_limit = models.PositiveIntegerField(default=1)
    used_count = models.PositiveIntegerField(default=0)
    date_created = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.code
    
    
class Wishlist(BaseModel):
    """Lista de desejos"""
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='wishlists', verbose_name='Usuário')
    name = models.CharField(max_length=200, default='Minha Lista de Desejos', verbose_name='Nome')
    is_public = models.BooleanField(default=False, verbose_name='Pública')
    is_default = models.BooleanField(default=True, verbose_name='Padrão')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Lista de Desejos'
        verbose_name_plural = 'Listas de Desejos'
        ordering = ['-is_default', '-updated_at']

    def __str__(self):
        return f"{self.name} - {self.user.get_full_name() or self.user.username}"

    @property
    def total_items(self):
        return self.items.count()

class WishlistItem(BaseModel):
    """Itens da wishlist"""
    wishlist = models.ForeignKey(Wishlist, on_delete=models.CASCADE, related_name='items', verbose_name='Lista de Desejos')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, verbose_name='Produto')
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.CASCADE, null=True, blank=True, verbose_name='Variante')
    added_at = models.DateTimeField(auto_now_add=True, verbose_name='Adicionado em')

    class Meta:
        verbose_name = 'Item da Lista de Desejos'
        verbose_name_plural = 'Itens da Lista de Desejos'
        unique_together = ['wishlist', 'product', 'variant']
        ordering = ['-added_at']

    def __str__(self):
        product_name = self.variant.product.name if self.variant else self.product.name
        return f"{product_name} - {self.wishlist.name}"

class RecentlyViewedProduct(BaseModel):
    """Produtos visitados recentemente"""
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True)
    session_key = models.CharField('Chave da Sessão', max_length=100, null=True, blank=True)
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    viewed_at = models.DateTimeField('Visitado em', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Produto Visitado Recentemente'
        verbose_name_plural = 'Produtos Visitados Recentemente'
        indexes = [
            models.Index(fields=['user', 'viewed_at']),
            models.Index(fields=['session_key', 'viewed_at']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(user__isnull=False) | models.Q(session_key__isnull=False),
                name='user_or_session_required'
            )
        ]

class CustomerSegment(BaseModel):
    """Segmentos de clientes"""
    name = models.CharField('Nome', max_length=200)
    description = models.TextField('Descrição', blank=True)
    filters = JSONField('Filtros', default=dict)  # Critérios de segmentação
    is_active = models.BooleanField('Ativo', default=True)
    
    class Meta:
        verbose_name = 'Segmento de Cliente'
        verbose_name_plural = 'Segmentos de Clientes'
        indexes = [
            GinIndex(fields=['filters']),
        ]
    
    def __str__(self):
        return self.name
from django.db import models
from django.contrib.postgres.fields import JSONField
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

class ProductReview(BaseModel):
    """Reviews/Avaliações de produtos"""
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='reviews')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.SET_NULL, null=True, blank=True)
    
    rating = models.PositiveIntegerField('Avaliação')  # 1-5
    title = models.CharField('Título', max_length=200, blank=True)
    review = models.TextField('Comentário', blank=True)
    images = JSONField('Imagens', default=list, blank=True)  # Array de URLs
    
    # Status
    is_verified_purchase = models.BooleanField('Compra Verificada', default=False)
    is_approved = models.BooleanField('Aprovado', default=False)
    helpful_count = models.PositiveIntegerField('Útil', default=0)
    
    class Meta:
        verbose_name = 'Avaliação'
        verbose_name_plural = 'Avaliações'
        unique_together = ['product', 'user', 'order_item']
        indexes = [
            models.Index(fields=['product', 'is_approved']),
            models.Index(fields=['rating']),
            models.Index(fields=['is_verified_purchase']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rating__gte=1, rating__lte=5),
                name='rating_range_1_to_5'
            )
        ]
    
    def __str__(self):
        return f"Avaliação de {self.user.username} para {self.product.name}"

class Wishlist(BaseModel):
    """Lista de desejos"""
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='wishlists')
    name = models.CharField('Nome', max_length=200, default='Minha Lista de Desejos')
    is_public = models.BooleanField('Pública', default=False)
    is_default = models.BooleanField('Padrão', default=True)
    
    class Meta:
        verbose_name = 'Lista de Desejos'
        verbose_name_plural = 'Listas de Desejos'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'is_default'], 
                condition=models.Q(is_default=True, is_deleted=False),
                name='unique_default_wishlist_per_user'
            )
        ]
    
    def __str__(self):
        return f"{self.name} ({self.user.username})"

class WishlistItem(models.Model):
    """Itens da lista de desejos"""
    wishlist = models.ForeignKey(Wishlist, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    variant = models.ForeignKey('products.ProductVariant', on_delete=models.CASCADE, null=True, blank=True)
    added_at = models.DateTimeField('Adicionado em', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Item da Lista de Desejos'
        verbose_name_plural = 'Itens das Listas de Desejos'
        unique_together = ['wishlist', 'product', 'variant']

class RecentlyViewedProduct(models.Model):
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
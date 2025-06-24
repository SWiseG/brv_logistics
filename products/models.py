from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from models.base import BaseModel
from django.utils.text import slugify
import uuid
from django.urls import reverse


User = get_user_model()

class ProductCategory(BaseModel):
    """Categorias de produtos (hierárquica)"""
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children', verbose_name='Categoria Pai')
    name = models.CharField(max_length=200, verbose_name='Nome')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='Slug')
    description = models.TextField(blank=True, verbose_name='Descrição')
    image = models.ImageField(upload_to='categories/', blank=True, null=True, verbose_name='Imagem')
    meta_title = models.CharField(max_length=200, blank=True, verbose_name='Meta Título')
    meta_description = models.TextField(blank=True, verbose_name='Meta Descrição')
    sort_order = models.IntegerField(default=0, verbose_name='Ordem')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Categoria'
        verbose_name_plural = 'Categorias'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def children(self):
        """Retorna subcategorias ativas"""
        return self.__class__.objects.filter(
            parent=self, 
            is_active=True
        ).order_by('sort_order', 'name')
    
    def get_absolute_url(self):
        return reverse('products:category', kwargs={'slug': self.slug})
    
    class Meta:
        verbose_name = 'Categoria'
        verbose_name_plural = 'Categorias'


class ProductBrand(BaseModel):
    """Marcas de produtos"""
    name = models.CharField(max_length=200, verbose_name='Nome')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='Slug')
    description = models.TextField(blank=True, verbose_name='Descrição')
    logo = models.ImageField(upload_to='brands/', blank=True, null=True, verbose_name='Logo')
    website = models.URLField(blank=True, verbose_name='Website')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

class Product(BaseModel):
    """Produtos principais"""
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    category = models.ForeignKey(
        ProductCategory, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name='Categoria',
        related_name='products'  # IMPORTANTE: Este é o nome usado no Count()
    )
    brand = models.ForeignKey(ProductBrand, on_delete=models.SET_NULL, null=True, blank=True, related_name='products', verbose_name='Marca')
    supplier = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='products', verbose_name='Fornecedor')
    
    # Identificação
    sku = models.CharField(max_length=100, unique=True, verbose_name='SKU')
    ean = models.CharField(max_length=20, blank=True, verbose_name='Código de Barras')
    name = models.CharField(max_length=300, verbose_name='Nome')
    slug = models.SlugField(max_length=300, unique=True, verbose_name='Slug')
    
    # Descrições
    short_description = models.TextField(blank=True, verbose_name='Descrição Curta')
    description = models.TextField(blank=True, verbose_name='Descrição')
    specifications = models.JSONField(default=dict, blank=True, verbose_name='Especificações')
    
    # Preços
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Preço de Custo')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Preço')
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Preço De/Por')
    
    # Físico
    weight = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name='Peso (kg)')
    length = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name='Comprimento (cm)')
    width = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name='Largura (cm)')
    height = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name='Altura (cm)')
    
    # Status e configurações
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_featured = models.BooleanField(default=False, verbose_name='Destaque')
    is_digital = models.BooleanField(default=False, verbose_name='Produto Digital')
    requires_shipping = models.BooleanField(default=True, verbose_name='Requer Envio')
    track_inventory = models.BooleanField(default=True, verbose_name='Controlar Estoque')
    allow_backorder = models.BooleanField(default=False, verbose_name='Permitir Pré-venda')
    
    # SEO
    meta_title = models.CharField(max_length=200, blank=True, verbose_name='Meta Título')
    meta_description = models.TextField(blank=True, verbose_name='Meta Descrição')
    meta_keywords = models.TextField(blank=True, verbose_name='Meta Palavras-chave')
    
    # Datas
    available_from = models.DateTimeField(auto_now_add=True, verbose_name='Disponível a partir de')
    available_until = models.DateTimeField(null=True, blank=True, verbose_name='Disponível até')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Produto'
        verbose_name_plural = 'Produtos'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def has_discount(self):
        return self.compare_at_price and self.compare_at_price > self.price

    @property
    def discount_percentage(self):
        if self.has_discount:
            return round(((self.compare_at_price - self.price) / self.compare_at_price) * 100)
        return 0
    
    def get_absolute_url(self):
        return reverse('products:detail', kwargs={
            'slug': self.slug
        })
    
    def get_primary_image(self):
        """Retorna a URL da imagem principal do produto"""
        primary_image = self.images.filter(is_primary=True).first()
        if primary_image:
            return primary_image.image.url
        
        # Se não tem imagem principal, pega a primeira
        first_image = self.images.first()
        if first_image:
            return first_image.image.url
        
        # Placeholder se não tem imagem
        return None
    
    def get_formatted_price(self):
        return f'R$ {self.price:.2f}'.replace('.', ',')
    
    def get_discount_percentage(self):
        if self.compare_at_price and self.compare_at_price > self.price:
            return int(((self.compare_at_price - self.price) / self.compare_at_price) * 100)
        return 0


class ProductVariant(BaseModel):
    """Variantes de produtos (tamanho, cor, etc.)"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants', verbose_name='Produto')
    sku = models.CharField(max_length=100, unique=True, verbose_name='SKU')
    ean = models.CharField(max_length=20, blank=True, verbose_name='Código de Barras')
    
    # Atributos da variante
    attributes = models.JSONField(verbose_name='Atributos')  # {"size": "M", "color": "Red"}
    
    # Preços específicos da variante
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Preço')
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Preço De/Por')
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Preço de Custo')
    
    # Físico específico
    weight = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name='Peso (kg)')
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Variante do Produto'
        verbose_name_plural = 'Variantes dos Produtos'
        ordering = ['-created_at']

    def __str__(self):
        attrs = ', '.join([f"{k}: {v}" for k, v in self.attributes.items()])
        return f"{self.product.name} - {attrs}"

    @property
    def effective_price(self):
        return self.price if self.price else self.product.price


class ProductAttribute(BaseModel):
    """Atributos de produtos (flexível para qualquer tipo)"""
    ATTRIBUTE_TYPES = [
        ('text', 'Texto'),
        ('number', 'Número'),
        ('boolean', 'Verdadeiro/Falso'),
        ('select', 'Seleção'),
        ('multiselect', 'Múltipla Seleção'),
        ('date', 'Data'),
    ]
    
    name = models.CharField(max_length=200, verbose_name='Nome')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='Slug')
    type = models.CharField(max_length=50, choices=ATTRIBUTE_TYPES, default='text', verbose_name='Tipo')
    is_required = models.BooleanField(default=False, verbose_name='Obrigatório')
    is_filterable = models.BooleanField(default=False, verbose_name='Filtrável')
    sort_order = models.IntegerField(default=0, verbose_name='Ordem')
    options = models.JSONField(default=list, blank=True, verbose_name='Opções')  # Para tipos select/multiselect
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    class Meta:
        verbose_name = 'Atributo do Produto'
        verbose_name_plural = 'Atributos dos Produtos'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class ProductAttributeValue(BaseModel):
    """Valores dos atributos por produto"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='attribute_values', verbose_name='Produto')
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.CASCADE, verbose_name='Atributo')
    value = models.TextField(verbose_name='Valor')

    class Meta:
        verbose_name = 'Valor do Atributo'
        verbose_name_plural = 'Valores dos Atributos'
        unique_together = ['product', 'attribute']

    def __str__(self):
        return f"{self.product.name} - {self.attribute.name}: {self.value}"


class ProductImage(BaseModel):
    """Imagens de produtos"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images', verbose_name='Produto')
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, null=True, blank=True, related_name='images', verbose_name='Variante')
    image = models.ImageField(upload_to='products/', verbose_name='Imagem')
    alt_text = models.CharField(max_length=200, blank=True, verbose_name='Texto Alternativo')
    sort_order = models.IntegerField(default=0, verbose_name='Ordem')
    is_primary = models.BooleanField(default=False, verbose_name='Imagem Principal')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    class Meta:
        verbose_name = 'Imagem do Produto'
        verbose_name_plural = 'Imagens dos Produtos'
        ordering = ['sort_order', '-is_primary']

    def __str__(self):
        return f"Imagem de {self.product.name}"


class ProductReview(BaseModel):
    """Reviews/Avaliações de produtos"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews', verbose_name='Produto')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews', verbose_name='Usuário')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Item do Pedido')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], verbose_name='Avaliação')
    title = models.CharField(max_length=200, blank=True, verbose_name='Título')
    review = models.TextField(blank=True, verbose_name='Comentário')
    images = models.JSONField(default=list, blank=True, verbose_name='Imagens')  # Array de URLs de imagens
    is_verified_purchase = models.BooleanField(default=False, verbose_name='Compra Verificada')
    is_approved = models.BooleanField(default=False, verbose_name='Aprovado')
    helpful_count = models.IntegerField(default=0, verbose_name='Útil')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Avaliação'
        verbose_name_plural = 'Avaliações'
        unique_together = ['product', 'user', 'order_item']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} - {self.rating} estrelas por {self.user.get_full_name()}"
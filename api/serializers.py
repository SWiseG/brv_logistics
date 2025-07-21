from rest_framework import serializers
from django.db import transaction
from analytics.models import *
from core.models import *
from inventory.models import *
from marketing.models import *
from orders.models import *
from payments.models import *
from products.models import *
from shipping.models import *
from suppliers.models import *
from theme.models import *
from users.models import *

class ProductCategorySerializer(serializers.ModelSerializer):
    """Product category serializer with hierarchy"""
    
    children = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    product_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ProductCategory
        fields = '__all__'
    
    def get_children(self, obj):
        """Get category children"""
        if obj.children.exists():
            return ProductCategorySerializer(obj.children.all(), many=True).data
        return []    

class ProductBrandSerializer(serializers.ModelSerializer):
    """Product brand serializer"""
    
    class Meta:
        model = ProductBrand
        fields = '__all__'

class ProductImageSerializer(serializers.ModelSerializer):
    """Product image serializer"""
    
    class Meta:
        model = ProductImage
        fields = '__all__'

class ProductVariantSerializer(serializers.ModelSerializer):
    """Product variant serializer"""
    
    images = ProductImageSerializer(many=True, read_only=True)
    
    class Meta:
        model = ProductVariant
        fields = '__all__'

class ProductAttributeValueSerializer(serializers.ModelSerializer):
    """Product attribute value serializer"""
    
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)
    attribute_type = serializers.CharField(source='attribute.type', read_only=True)
    
    class Meta:
        model = ProductAttributeValue
        fields = '__all__'

class ProductReviewSerializer(serializers.ModelSerializer):
    """Product review serializer"""
    
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = ProductReview
        fields = '__all__'
        read_only_fields = ('user', 'is_verified_purchase', 'helpful_count')
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class ProductSerializer(serializers.ModelSerializer):
    """Complete product serializer"""
    
    category_name = serializers.CharField(source='category.name', read_only=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    attributes = ProductAttributeValueSerializer(many=True, read_only=True)
    reviews = ProductReviewSerializer(many=True, read_only=True)
    
    # Calculated fields
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = '__all__'
    
    def get_average_rating(self, obj):
        """Calculate average rating"""
        reviews = obj.reviews.filter(is_approved=True)
        if reviews.exists():
            return round(sum([r.rating for r in reviews]) / reviews.count(), 2)
        return 0
    
    def get_review_count(self, obj):
        """Get review count"""
        return obj.reviews.filter(is_approved=True).count()
    
    def get_is_in_stock(self, obj):
        """Check if product is in stock"""
        if obj.track_inventory:
            return obj.inventory_items.filter(quantity_available__gt=0).exists()
        return True

class CartItemSerializer(serializers.ModelSerializer):
    """Shopping cart item serializer"""
    
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    total_price = serializers.SerializerMethodField()
    
    class Meta:
        model = CartItem
        fields = '__all__'
        read_only_fields = ('cart',)
    
    def get_product_image(self, obj):
        """Get product main image"""
        image = obj.product.images.filter(is_primary=True).first()
        if image:
            return self.context['request'].build_absolute_uri(image.image.url)
        return None
    
    def get_total_price(self, obj):
        """Calculate total price for item"""
        return obj.quantity * obj.unit_price
    
    def validate_quantity(self, value):
        """Validate quantity against stock"""
        if value <= 0:
            raise serializers.ValidationError("Quantidade deve ser maior que zero.")
        
        # Check stock if tracking inventory
        product = self.instance.product if self.instance else None
        if product and product.track_inventory:
            available = sum([
                item.quantity_available 
                for item in product.inventory_items.all()
            ])
            if value > available:
                raise serializers.ValidationError(f"Apenas {available} unidades disponíveis.")
        
        return value

class CartSerializer(serializers.ModelSerializer):
    """Shopping cart serializer"""
    
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Cart
        fields = '__all__'
        read_only_fields = ('user', 'session_key')
    
    def get_total_items(self, obj):
        """Get total items count"""
        return sum([item.quantity for item in obj.items.all()])
    
    def get_total_amount(self, obj):
        """Calculate total cart amount"""
        return sum([item.quantity * item.unit_price for item in obj.items.all()])

class OrderItemSerializer(serializers.ModelSerializer):
    """Order item serializer"""
    
    class Meta:
        model = OrderItem
        fields = '__all__'

class OrderSerializer(serializers.ModelSerializer):
    """Order serializer with items"""
    
    items = OrderItemSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('user', 'order_number', 'uuid')

class PaymentTransactionSerializer(serializers.ModelSerializer):
    """Payment transaction serializer"""
    
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    
    class Meta:
        model = PaymentTransaction
        fields = '__all__'
        read_only_fields = ('uuid', 'external_id', 'processed_at')

class CouponSerializer(serializers.ModelSerializer):
    """Coupon serializer"""
    
    is_valid = serializers.SerializerMethodField()
    remaining_uses = serializers.SerializerMethodField()
    
    class Meta:
        model = Coupon
        fields = '__all__'
    
    def get_is_valid(self, obj):
        """Check if coupon is valid"""
        from django.utils import timezone
        now = timezone.now()
        
        # Check if active and not expired
        if not obj.is_active or (obj.expires_at and obj.expires_at < now):
            return False
        
        # Check usage limits
        if obj.usage_limit and obj.used_count >= obj.usage_limit:
            return False
        
        return True
    
    def get_remaining_uses(self, obj):
        """Get remaining uses"""
        if obj.usage_limit:
            return max(0, obj.usage_limit - obj.used_count)
        return None
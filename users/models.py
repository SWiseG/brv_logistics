from models.base import BaseModel, BaseModelWithoutSoftDelete
from django.contrib.auth.models import AbstractUser, Group
from django.db.models import Q, CheckConstraint
from django.db import models

class User(AbstractUser, BaseModelWithoutSoftDelete):
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    is_customer = models.BooleanField(default=True)
    is_merchant = models.BooleanField(default=False)
    date_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            CheckConstraint(
                check=Q(phone__isnull=True) | ~Q(phone=''),
                name='phone_not_empty_if_provided'
            ),
        ]

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return self.email
    
class GroupType(BaseModel):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='group')
    is_adm = models.BooleanField(default=False)
    is_dev = models.BooleanField(default=False)

class Address(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    address_type = models.CharField(max_length=10, choices=[('billing', 'Faturamento'), ('shipping', 'Entrega'), ('both', 'Ambos')])
    street = models.CharField(max_length=255)
    number = models.CharField(max_length=20)
    complement = models.CharField(max_length=255, blank=True, null=True)
    neighborhood = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default='Brasil')
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    postal_code = models.CharField(max_length=10)
    is_default = models.BooleanField(default=False)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'address'
        unique_together = ('user', 'address_type', 'is_default')
        indexes = [
            models.Index(fields=['user', 'address_type']),
            models.Index(fields=['postal_code']),
            models.Index(fields=['is_default']),
        ]
        constraints = [
            CheckConstraint(
                check=~Q(street=''),
                name='street'
            ),
            CheckConstraint(
                check=~Q(city=''),
                name='city_not_empty'
            )
    ]
    def save(self, *args, **kwargs):
        # Garantir apenas um endereço padrão por tipo
        if self.is_default:
            Address.objects.filter(
                user=self.user,
                address_type=self.address_type,
                is_default=True
            ).update(is_default=False)
        super().save(*args, **kwargs)
        
    def get_full_address(self):
        parts = [self.street, self.number]
        parts.extend([self.city, self.state, self.postal_code, self.country])
        return ', '.join(parts)
    
    def __str__(self):
        return f"{self.address_type} - {self.get_full_address()}"
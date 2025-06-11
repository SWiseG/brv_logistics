from django.contrib.auth.models import AbstractUser, Group
from django.db import models

class User(AbstractUser):
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    is_customer = models.BooleanField(default=True)
    is_merchant = models.BooleanField(default=False)
    date_updated = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.email
    
class GroupType(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='group')
    is_adm = models.BooleanField(default=False)
    is_dev = models.BooleanField(default=False)

class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    address_type = models.CharField(max_length=10, choices=[('billing', 'Faturamento'), ('shipping', 'Entrega')])
    street = models.CharField(max_length=255)
    number = models.CharField(max_length=20)
    complement = models.CharField(max_length=255, blank=True, null=True)
    neighborhood = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    zipcode = models.CharField(max_length=10)
    is_default = models.BooleanField(default=False)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('user', 'address_type', 'is_default')
    
    def __str__(self):
        return f"{self.street}, {self.number} - {self.city}/{self.state}"

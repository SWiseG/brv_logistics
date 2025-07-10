import uuid
from django.db import models
from django.utils import timezone
from django.contrib.postgres.indexes import GinIndex
from .managers import SoftDeleteManager

class TimestampMixin(models.Model):
    """Mixin para timestamps automáticos"""
    created_at = models.DateTimeField('Criado em', default=timezone.now)
    updated_at = models.DateTimeField('Atualizado em', auto_now=True)
    
    class Meta:
        abstract = True

class UUIDMixin(models.Model):
    """Mixin para UUID público"""
    uuid = models.UUIDField('UUID Público', default=uuid.uuid4, unique=True)
    
    class Meta:
        abstract = True

class SoftDeleteManager(models.Manager):
    """Manager para soft delete"""
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

class SoftDeleteMixin(models.Model):
    """Mixin para soft delete"""
    is_deleted = models.BooleanField('Deletado', default=False)
    deleted_at = models.DateTimeField('Deletado em', null=True, blank=True)
    deleted_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, 
        null=True, blank=True, related_name='deleted_%(class)s'
    )
    
    objects = SoftDeleteManager()
    
    def delete(self, user=None, hard=False):
        if hard:
            super().delete()
        else:
            self.is_deleted = True
            self.deleted_at = timezone.now()
            self.deleted_by = user
            self.save()
    
    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()
    
    class Meta:
        abstract = True

class BaseModel(TimestampMixin, UUIDMixin, SoftDeleteMixin):
    """Model base com todos os mixins"""
    
    class Meta:
        abstract = True

class BaseModelWithoutSoftDelete(UUIDMixin, TimestampMixin):
    """Base sem soft delete para modelos que não precisam"""
    class Meta:
        abstract = True
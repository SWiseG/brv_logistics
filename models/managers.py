from django.db import models
from django.db.models import Q

class SoftDeleteQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_deleted=False)
    
    def deleted(self):
        return self.filter(is_deleted=True)
    
    def with_deleted(self):
        return self

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).active()
    
    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)
    
    def deleted_only(self):
        return SoftDeleteQuerySet(self.model, using=self._db).deleted()
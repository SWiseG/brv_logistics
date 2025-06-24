from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to the owner of the object.
        return obj.user == request.user

class IsOwnerOrStaff(permissions.BasePermission):
    """
    Permission for owners or staff members
    """
    
    def has_object_permission(self, request, view, obj):
        # Staff members can access everything
        if request.user.is_staff:
            return True
        
        # Owners can access their own objects
        return hasattr(obj, 'user') and obj.user == request.user

class IsStaffOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow staff to create/edit.
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return request.user and request.user.is_staff

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission for admin-only write access
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return request.user and request.user.is_superuser

class IsVerifiedUser(permissions.BasePermission):
    """
    Permission for verified users only
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_verified
        )
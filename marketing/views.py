from django.http import JsonResponse
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from .models import WishlistItem

class UpdateWishlistCountView(View):
    """View para atualizar contador da wishlist via AJAX"""
    
    @method_decorator(login_required)
    def get(self, request):
        wishlist_count = WishlistItem.objects.filter(
            wishlist__user=request.user,
            wishlist__is_default=True
        ).count()
        
        return JsonResponse({
            'wishlist_count': wishlist_count
        })
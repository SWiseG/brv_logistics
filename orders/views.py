from django.http import JsonResponse
from django.views import View
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.db.models import Sum
from django.template.loader import render_to_string
from .models import CartItem

@method_decorator(login_required, name='dispatch')
class CartDropdownView(View):
    """View para conteúdo do dropdown do carrinho"""
    
    def get(self, request):
        try:
            # Buscar itens do carrinho
            cart_items = CartItem.objects.filter(
                cart__user=request.user
            ).select_related(
                'product', 'variant'
            ).prefetch_related(
                'product__images'
            )[:5]  # Mostrar apenas os primeiros 5 itens
            
            # Calcular total
            total_amount = sum(
                item.quantity * (item.variant.price if item.variant else item.product.price)
                for item in cart_items
            )
            
            # Total de itens
            total_items = sum(item.quantity for item in cart_items)
            
            # Renderizar template
            html = render_to_string('components/cart_dropdown.html', {
                'cart_items': cart_items,
                'total_amount': total_amount,
                'total_items': total_items,
            }, request=request)
            
            return JsonResponse({
                'html': html,
                'total_items': total_items,
                'total_amount': float(total_amount),
                'formatted_total': f'R$ {total_amount:.2f}',
            })
            
        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)


class UpdateCartCountView(View):
    """View para atualizar contador do carrinho via AJAX"""
    
    def get(self, request):
        if request.user.is_authenticated:
            cart_count = CartItem.objects.filter(
                cart__user=request.user
            ).aggregate(
                total_items=Sum('quantity')
            )['total_items'] or 0
        else:
            # Para usuários não logados
            cart_count = 0
            if 'cart_items' in request.session:
                cart_count = sum(
                    item['quantity'] for item in request.session['cart_items'].values()
                )
        
        return JsonResponse({
            'cart_count': cart_count
        })

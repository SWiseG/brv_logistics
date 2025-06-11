from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required

def cart_detail(request):
    return render(request, 'orders/cart_detail.html')

def cart_add(request, product_id):
    return redirect('orders:cart_detail')

def cart_update(request, item_id):
    return redirect('orders:cart_detail')

def cart_remove(request, item_id):
    return redirect('orders:cart_detail')

@login_required
def checkout(request):
    return render(request, 'orders/checkout.html')

@login_required
def checkout_confirm(request):
    return redirect('orders:order_detail', order_number='123456')

@login_required
def order_list(request):
    return render(request, 'orders/order_list.html')

@login_required
def order_detail(request, order_number):
    return render(request, 'orders/order_detail.html')


from django.shortcuts import render, get_object_or_404
from django.core.paginator import Paginator

def product_list(request):
    return render(request, 'modules/products/product_list.html')

def product_detail(request, slug):
    return render(request, 'modules/products/product_detail.html')

def category_detail(request, slug):
    return render(request, 'modules/products/category_detail.html')


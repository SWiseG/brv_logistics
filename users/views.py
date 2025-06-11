from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required

@login_required
def profile(request):
    return render(request, 'users/profile.html')

@login_required
def profile_edit(request):
    return render(request, 'users/profile_edit.html')

@login_required
def address_list(request):
    return render(request, 'users/address_list.html')

@login_required
def address_add(request):
    return render(request, 'users/address_form.html')

@login_required
def address_edit(request, pk):
    return render(request, 'users/address_form.html')

@login_required
def address_delete(request, pk):
    return redirect('users:address_list')


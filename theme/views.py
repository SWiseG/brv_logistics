from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.admin.views.decorators import staff_member_required

@staff_member_required
def theme_list(request):
    return render(request, 'theme/theme_list.html')

@staff_member_required
def theme_edit(request, pk):
    return render(request, 'theme/theme_edit.html')

@staff_member_required
def theme_activate(request, pk):
    return redirect('theme:theme_list')


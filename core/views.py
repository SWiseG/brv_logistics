from django.shortcuts import render

def home(request):
    return render(request, 'modules/core/home.html')

def contact(request):
    return render(request, 'modules/core/contact.html')

def about(request):
    return render(request, 'modules/core/about.html')

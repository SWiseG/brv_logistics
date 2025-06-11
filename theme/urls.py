from django.urls import path
from . import views

app_name = 'theme'

urlpatterns = [
    path('personalizar/', views.customize_theme, name='customize_theme'),
]


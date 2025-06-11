from django.urls import path
from . import views

app_name = 'users'

urlpatterns = [
    path('perfil/', views.profile, name='profile'),
    path('perfil/editar', views.profile_edit, name='profile_edit'),
    path('enderecos/', views.address_list, name='address_list'),
    path('enderecos/adicionar', views.address_add, name='address_add'),
    # path('enderecos/editar/<:pk>', views.address_edit, name='address_edit'),
    # path('enderecos/deletar/<:pk>', views.address_delete, name='address_delete')
]


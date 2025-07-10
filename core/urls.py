from django.urls import path
from .views import *

app_name = 'core'

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('home', HomeView.as_view(), name='home'),
    path('sobre/', AboutView.as_view(), name='about'),
    path('contato/', ContactView.as_view(), name='contact'),
    
    # Search
    path('search/suggestions/', SearchSuggestionsView.as_view(), name='search_suggestions'),
    
    # Static Modals
    path('modals/', static_modals, name='modals')
]


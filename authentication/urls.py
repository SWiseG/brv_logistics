from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

app_name = 'auth'

urlpatterns = [
    # Authentication
    path('login/', views.LoginView.as_view(), name='login'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # Verificação de email
    path('verify-email/', views.EmailVerificationView.as_view(), name='verify_email'),
    path('resend-verification/', views.ResendVerificationView.as_view(), name='resend_verification'),
    
    # Perfil
    path('profile/', views.ProfileView.as_view(), name='profile'),
    path('edit-profile/', views.EditProfileView.as_view(), name='edit_profile'),
    
    # Endereços
    path('addresses/', views.AddressManagementView.as_view(), name='addresses'),
    
    # Password Management
    path('check-email/', views.CheckEmailView.as_view(), name='check_email'),
    
    # Recuperação de senha
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password_reset'),
    path('verify-reset-code/', views.VerifyResetCodeView.as_view(), name='verify_reset_code'),
    path('password-reset-form/', views.PasswordResetFormView.as_view(), name='password_reset_form'),
    path('resend-reset-code/', views.ResendResetCodeView.as_view(), name='resend_reset_code'),
    
    # Alteração de senha (usuário logado)
    path('change-password/', 
         auth_views.PasswordChangeView.as_view(
             template_name='accounts/change_password.html',
             success_url='/accounts/profile/'
         ), name='change_password'),
]
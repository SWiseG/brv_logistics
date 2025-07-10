from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.core.exceptions import ValidationError
from django.contrib.auth import authenticate
import re

from .models import Address, User

class CustomUserCreationForm(UserCreationForm):
    """Formulário customizado de criação de usuário"""
    
    # Campos básicos
    first_name = forms.CharField(
        max_length=150,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Seu primeiro nome'
        }),
        label='Nome'
    )
    
    last_name = forms.CharField(
        max_length=150,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Seu sobrenome'
        }),
        label='Sobrenome'
    )
    
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'seu@email.com'
        }),
        label='E-mail'
    )
    
    phone = forms.CharField(
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '(11) 99999-9999',
            'data-mask': '(00) 00000-0000'
        }),
        label='Telefone'
    )
    
    date_of_birth = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        }),
        label='Data de Nascimento'
    )
    
    # Senha customizada
    password1 = forms.CharField(
        label='Senha',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Mínimo 8 caracteres'
        })
    )
    
    password2 = forms.CharField(
        label='Confirmar Senha',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Digite a senha novamente'
        })
    )
    
    # Termos e newsletter
    accept_terms = forms.BooleanField(
        required=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='Li e aceito os termos de uso e política de privacidade'
    )
    
    newsletter_subscribed = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='Quero receber ofertas e novidades por e-mail'
    )
    
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email', 'password1', 'password2')
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remover help_text padrão das senhas
        self.fields['password1'].help_text = None
        self.fields['password2'].help_text = None
    
    def clean_email(self):
        email = self.cleaned_data.get('email', '').lower()
        
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError('Este e-mail já está cadastrado.')
        
        return email
    
    def clean_phone(self):
        phone = self.cleaned_data.get('phone', '')
        
        if phone:
            # Remover caracteres não numéricos
            phone_digits = re.sub(r'\D', '', phone)
            
            # Validar formato brasileiro
            if not re.match(r'^(?:\+55\s?)?(?:\d{2}\s?)?\d{4,5}\d{4}$', phone_digits):
                raise ValidationError('Formato de telefone inválido.')
        
        return phone
    
    def clean_password1(self):
        password1 = self.cleaned_data.get('password1')
        
        if password1:
            # Validações customizadas
            if len(password1) < 8:
                raise ValidationError('A senha deve ter pelo menos 8 caracteres.')
            
            if password1.isdigit():
                raise ValidationError('A senha não pode conter apenas números.')
            
            if password1.lower() in ['12345678', 'password', 'senha123']:
                raise ValidationError('Esta senha é muito comum.')
        
        return password1
    
    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.username = self.cleaned_data['email']  # Usar email como username
        
        if commit:
            user.save()
        
        return user

class CustomAuthenticationForm(AuthenticationForm):
    """Formulário customizado de login"""
    
    username = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'seu@email.com',
            'autofocus': True
        }),
        label='E-mail'
    )
    
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Sua senha'
        }),
        label='Senha'
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].label = 'E-mail'
    
    def clean_username(self):
        username = self.cleaned_data.get('username', '').lower()
        return username

class UserUpdateForm(forms.ModelForm):
    """Formulário para atualizar dados do usuário"""
    
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email')
        widgets = {
            'first_name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Seu primeiro nome'
            }),
            'last_name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Seu sobrenome'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'seu@email.com'
            }),
        }
        labels = {
            'first_name': 'Nome',
            'last_name': 'Sobrenome',
            'email': 'E-mail',
        }
    
    def clean_email(self):
        email = self.cleaned_data.get('email', '').lower()
        
        # Verificar se o email já existe (exceto para o usuário atual)
        if User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists():
            raise ValidationError('Este e-mail já está sendo usado por outro usuário.')
        
        return email
    
class AddressForm(forms.ModelForm):
    """Formulário para endereços do usuário"""
    
    class Meta:
        model = Address
        fields = (
            'address_type', 'street', 'number', 'complement',
            'neighborhood', 'city', 'state', 'country',
            'postal_code', 'is_default'
        )
        widgets = {
            'address_type': forms.RadioSelect(attrs={
                'class': 'form-control-choices',
                'placeholder': 'Tipo'
            }, choices=[('billing', 'Faturamento'), ('shipping', 'Entrega'), ('both', 'Ambos')]),
            'street': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Rua'
            }),
            'number': forms.TextInput(attrs={
                'class': 'form-control-numeric',
                'placeholder': 'Número'
            }),
            'complement': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Complemento'
            }),
            'neighborhood': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Bairro'
            }),
            'city': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Cidade'
            }),
            'state': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Estado'
            }),
            'country': forms.TextInput(attrs={
                'class': 'form-control',
                'value': 'Brasil'
            }),
            'postal_code': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '00000-000',
                'data-mask': '00000-000'
            }),
            'is_default': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }
        labels = {
            'address_type': 'Tipo',
            'neighborhood': 'Bairro', 
            'street': 'Rua',
            'number': 'Número',
            'complement': 'Complemento',
            'city': 'Cidade',
            'state': 'Estado',
            'postal_code': 'CEP',
            'country': 'País',
            'is_default': 'Endereço padrão'
        }
    
    def clean_postal_code(self):
        postal_code = self.cleaned_data.get('postal_code', '')
        
        if postal_code:
            # Remover caracteres não numéricos
            postal_code = re.sub(r'\D', '', postal_code)
            
            # Validar CEP brasileiro
            if len(postal_code) != 8:
                raise ValidationError('CEP deve conter 8 dígitos.')
            
            # Formatar CEP
            postal_code = f'{postal_code[:5]}-{postal_code[5:]}'
        
        return postal_code
import re
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from decimal import Decimal

def validate_cpf(value):
    """Validador de CPF brasileiro"""
    cpf = re.sub(r'[^0-9]', '', value)
    if len(cpf) != 11:
        raise ValidationError('CPF deve ter 11 dígitos')
    
    # Verificar se todos os dígitos são iguais
    if len(set(cpf)) == 1:
        raise ValidationError('CPF inválido')
    
    # Calcular dígitos verificadores
    for i in range(9, 11):
        value = sum((int(cpf[num]) * ((i+1) - num) for num in range(0, i)))
        digit = ((value * 10) % 11) % 10
        if digit != int(cpf[i]):
            raise ValidationError('CPF inválido')

def validate_cnpj(value):
    """Validador de CNPJ brasileiro"""
    cnpj = re.sub(r'[^0-9]', '', value)
    if len(cnpj) != 14:
        raise ValidationError('CNPJ deve ter 14 dígitos')
    
    # Verificar se todos os dígitos são iguais
    if len(set(cnpj)) == 1:
        raise ValidationError('CNPJ inválido')

def validate_positive_price(value):
    """Validador de preço positivo"""
    if value <= 0:
        raise ValidationError('O preço deve ser maior que zero')

def validate_postal_code(value):
    """Validador de CEP brasileiro"""
    cep = re.sub(r'[^0-9]', '', value)
    if len(cep) != 8:
        raise ValidationError('CEP deve ter 8 dígitos')

def validate_phone(value):
    """Validador de telefone brasileiro"""
    phone = re.sub(r'[^0-9]', '', value)
    if not (10 <= len(phone) <= 11):
        raise ValidationError('Telefone deve ter 10 ou 11 dígitos')
    
def validate_positive_decimal(value):
    """Validador para valores monetários positivos"""
    if value < Decimal('0'):
        raise ValidationError('Valor deve ser positivo')

def validate_sku(value):
    """Validador de SKU"""
    if not re.match(r'^[A-Z0-9\-_]+$', value):
        raise ValidationError(
        '   SKU deve conter apenas letras maiúsculas, números, hífens e sublinhados'
        )

# Validators pré-definidos
phone_validator = RegexValidator(
    regex=r'^\+?1?\d{10,11}$',
    message='Número de telefone deve estar no formato: +55123456789'
)
sku_validator = RegexValidator(
    regex=r'^[A-Z0-9\-_]+$',
    message='SKU deve conter apenas letras maiúsculas, números, hífens e sublinhados'
)

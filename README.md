# E-commerce Template

Um site de vendas completo e flexível desenvolvido com Django, Python, JS, jQuery, CSS e HTML.

## Características

- Sistema de usuários com perfis e endereços
- Catálogo de produtos com categorias e variantes
- Carrinho de compras e checkout
- Sistema de pedidos
- Temas personalizáveis para diferentes segmentos
- Painel administrativo completo
- Design responsivo

## Requisitos

- Python 3.8+
- Django 3.2+
- Outras dependências listadas em requirements.txt

## Instalação

1. Clone o repositório
2. Crie um ambiente virtual: `python -m venv venv`
3. Ative o ambiente virtual:
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`
4. Instale as dependências: `pip install -r requirements.txt`
5. Execute as migrações: `python manage.py migrate`
6. Crie um superusuário: `python manage.py createsuperuser`
7. Execute o servidor: `python manage.py runserver`

## Personalização

Para personalizar o template para diferentes segmentos:

1. Acesse o painel administrativo (/admin/)
2. Crie um novo tema com as cores e fontes desejadas
3. Faça upload do logotipo e favicon específicos do segmento
4. Ative o tema
5. Personalize as categorias e produtos de acordo com o segmento

## Licença

Este projeto está licenciado sob a licença MIT.

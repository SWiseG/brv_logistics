# accounts/management/commands/create_user.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from ...utils import EmailService

class Command(BaseCommand):
    help = 'Criar usuário manualmente'
    
    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True)
        parser.add_argument('--first-name', type=str, required=True)
        parser.add_argument('--last-name', type=str, required=True)
        parser.add_argument('--password', type=str, required=True)
        parser.add_argument('--send-welcome', action='store_true', help='Enviar email de boas-vindas')
    
    def handle(self, *args, **options):
        try:
            user = User.objects.create_user(
                username=options['email'],
                email=options['email'],
                password=options['password'],
                first_name=options['first_name'],
                last_name=options['last_name']
            )
            
            # Criar perfil
            group, created = Group.objects.get_or_create(name='Visitante')
            user.groups.add(group)
            
            if options['send_welcome']:
                EmailService.send_welcome_email(user)
                self.stdout.write(
                    self.style.SUCCESS(f'Usuário {user.email} criado e email de boas-vindas enviado!')
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'Usuário {user.email} criado com sucesso!')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Erro ao criar usuário: {e}')
            )

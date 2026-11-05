# SecurityMaster Intelligence

## Objetivo

Plataforma para análise inteligente dos relatórios exportados pelo Moni.

### Funcionalidades planejadas

### Cadastros
- Clientes ativos por cidade
- Clientes ativos por bairro
- Clientes por situação (Ativo, Suspenso e Cancelado)
- Clientes sem palavra-chave
- Clientes com palavra-chave
- Clientes com horário de alarme desarmado
- Clientes com setor Pânico
- Clientes com providências
- Clientes sem responsável
- Clientes com bilhetes
- Clientes por fabricante
- Clientes por tipo

### Eventos
- Eventos por tipo
- Eventos por cliente
- Eventos por horário
- Eventos por operador

## Estrutura do projeto

```
public/
src/
 ├── assets/
 ├── components/
 ├── css/
 ├── data/
 ├── database/
 ├── js/
 ├── services/
 └── utils/
docs/
```

## Fluxo da aplicação

```
Arquivo HTML
      ↓
Importador
      ↓
Parser
      ↓
Banco de Dados
      ↓
Dashboard
```
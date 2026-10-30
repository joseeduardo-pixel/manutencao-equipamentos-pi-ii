#!/bin/sh
set -eu

echo "Executando migracoes do banco de dados..."
npx prisma migrate deploy

echo "Iniciando a aplicacao..."
exec npm run start

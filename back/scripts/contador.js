import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  console.log({
    predios: await prisma.predio.count(),
    locais: await prisma.local.count(),
    grupos: await prisma.grupo.count(),
    categorias: await prisma.categoria.count(),
    marcas: await prisma.marca.count(),
    fornecedores: await prisma.fornecedor.count(),
    equipamentos: await prisma.equipamento.count(),
    manutencoes: await prisma.manutencao.count(),
    itens: await prisma.itemManutencao.count(),
  });
  await prisma.$disconnect();
})();

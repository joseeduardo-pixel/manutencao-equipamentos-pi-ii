import test from 'node:test';
import assert from 'node:assert/strict';

const EXPECTED_DATABASE = 'mydb_test_pi2';

test('Conexao Prisma utiliza exclusivamente o banco de testes', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');

  const databaseName = decodeURIComponent(
    new URL(databaseUrl).pathname.slice(1),
  );

  assert.equal(databaseName, EXPECTED_DATABASE);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const resultado = await prisma.$queryRaw`
      SELECT current_database() AS banco
    `;

    assert.equal(resultado[0].banco, EXPECTED_DATABASE);

    const totalEquipamentos = await prisma.equipamento.count();
    const totalManutencoes = await prisma.manutencao.count();

    assert.ok(totalEquipamentos >= 0);
    assert.ok(totalManutencoes >= 0);

    console.log('Banco confirmado:', resultado[0].banco);
    console.log('Equipamentos:', totalEquipamentos);
    console.log('Manutencoes:', totalManutencoes);
  } finally {
    await prisma.$disconnect();
  }
});

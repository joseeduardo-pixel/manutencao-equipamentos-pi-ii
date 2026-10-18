import test from 'node:test';
import assert from 'node:assert/strict';

const EXPECTED_DATABASE = 'mydb_test_pi2';

test('Protege predio que possui locais vinculados', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');

  const url = new URL(databaseUrl);

  assert.equal(
    decodeURIComponent(url.pathname.slice(1)),
    EXPECTED_DATABASE,
    'Banco de dados nao autorizado',
  );

  assert.notEqual(
    process.env.NODE_ENV,
    'production',
    'Ambiente de producao nao autorizado',
  );

  const { default: db } = await import('../../src/config/db.js');

  const resultado = await db.$queryRaw`
    SELECT current_database() AS banco
  `;

  assert.equal(resultado[0].banco, EXPECTED_DATABASE);

  const identificador = `PI2-PROTECAO-${Date.now()}`;

  let predio = null;
  let local = null;

  try {
    predio = await db.predio.create({
      data: {
        nome_predio: `Predio ${identificador}`,
      },
    });

    local = await db.local.create({
      data: {
        nome_local: `Local ${identificador}`,
        predio_id: predio.id,
      },
    });


    await assert.rejects(
      db.predio.delete({
        where: { id: predio.id },
      }),
      (erro) => {
        console.log('=== DIAGNOSTICO DA EXCLUSAO ===');
        console.log('Nome:', erro.name);
        console.log('Codigo:', erro.code);
        console.log('Mensagem:', erro.message);
        console.log('Meta:', erro.meta);

        const erroDeRestricao =
          erro.code === 'P2003' ||
          (
            erro.name === 'PrismaClientUnknownRequestError' &&
            erro.message?.includes('23001') &&
            erro.message?.includes('locais_predio_id_fkey')
          );

        assert.ok(
          erroDeRestricao,
          'A exclusao deveria ser bloqueada pela chave estrangeira.',
        );

        return true;
      },
    );

    const predioPreservado = await db.predio.findUnique({
      where: { id: predio.id },
    });

    const localPreservado = await db.local.findUnique({
      where: { id: local.id },
    });

    assert.ok(predioPreservado);
    assert.ok(localPreservado);

    assert.equal(localPreservado.predio_id, predio.id);

    console.log('Exclusao de predio bloqueada corretamente.');
    console.log('Predio e local preservados no PostgreSQL.');
  } finally {
    if (local?.id) {
      await db.local.deleteMany({
        where: { id: local.id },
      });
    }

    if (predio?.id) {
      await db.predio.deleteMany({
        where: { id: predio.id },
      });
    }
  }
});

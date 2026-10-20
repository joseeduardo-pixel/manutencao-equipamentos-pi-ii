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


test('Protege fornecedor que possui manutencao vinculada', async () => {
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

  const identificador = `PI2-FORN-${Date.now()}`;
  let fornecedor = null;
  let manutencao = null;

  try {
    fornecedor = await db.fornecedor.create({
      data: {
        razao_social: `Fornecedor ${identificador}`,
        cnpj: `${Date.now()}`.padStart(14, '0'),
      },
    });

    manutencao = await db.manutencao.create({
      data: {
        data: new Date('2026-10-19T12:00:00Z'),
        nota_fiscal: `NF-${identificador}`,
        solicitacao: 1001,
        finalizado: true,
        fornecedor_id: fornecedor.id,
      },
    });

    await assert.rejects(
      db.fornecedor.delete({
        where: { id: fornecedor.id },
      }),
      (erro) => {
        const bloqueado =
          erro.code === 'P2003' ||
          (
            erro.name === 'PrismaClientUnknownRequestError' &&
            erro.message?.includes('23001') &&
            erro.message?.includes('manutencoes_fornecedor_id_fkey')
          );

        assert.ok(bloqueado, 'Exclusao do fornecedor deveria ser bloqueada.');
        return true;
      },
    );

    assert.ok(
      await db.fornecedor.findUnique({
        where: { id: fornecedor.id },
      }),
    );

    assert.ok(
      await db.manutencao.findUnique({
        where: { id: manutencao.id },
      }),
    );

    console.log('Fornecedor e manutencao preservados corretamente.');
  } finally {
    if (manutencao?.id) {
      await db.manutencao.deleteMany({
        where: { id: manutencao.id },
      });
    }

    if (fornecedor?.id) {
      await db.fornecedor.deleteMany({
        where: { id: fornecedor.id },
      });
    }
  }
});

test('Protege equipamento com item de manutencao vinculado', async () => {
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

  const identificador = `PI2-EQUIP-${Date.now()}`;
  const criados = {};

  try {
    criados.predio = await db.predio.create({
      data: { nome_predio: `Predio ${identificador}` },
    });

    criados.local = await db.local.create({
      data: {
        nome_local: `Local ${identificador}`,
        predio_id: criados.predio.id,
      },
    });

    criados.grupo = await db.grupo.create({
      data: { nome_grupo: `Grupo ${identificador}` },
    });

    criados.categoria = await db.categoria.create({
      data: {
        nome_categoria: `Categoria ${identificador}`,
        grupo_id: criados.grupo.id,
      },
    });

    criados.marca = await db.marca.create({
      data: { marca: `Marca ${identificador}` },
    });

    criados.equipamento = await db.equipamento.create({
      data: {
        patrimonio: identificador,
        capacidade: 12000,
        unidade_medida: 'BTUs',
        valor_bem: 3500,
        situacao: 'Ativo',
        tipo: 'Split',
        modelo: 'Modelo de Teste',
        categoria_id: criados.categoria.id,
        marca_id: criados.marca.id,
        local_id: criados.local.id,
      },
    });

    criados.fornecedor = await db.fornecedor.create({
      data: {
        razao_social: `Fornecedor ${identificador}`,
        cnpj: `${Date.now() + 1}`.padStart(14, '0'),
      },
    });

    criados.manutencao = await db.manutencao.create({
      data: {
        data: new Date('2026-10-19T12:00:00Z'),
        nota_fiscal: `NF-${identificador}`,
        solicitacao: 1002,
        finalizado: true,
        fornecedor_id: criados.fornecedor.id,
      },
    });

    criados.item = await db.itemManutencao.create({
      data: {
        descricao: 'Manutencao ficticia de equipamento',
        quantidade: 1,
        valor_unitario: 150,
        equipamento_id: criados.equipamento.id,
        manutencao_id: criados.manutencao.id,
      },
    });

    await assert.rejects(
      db.equipamento.delete({
        where: { id: criados.equipamento.id },
      }),
      (erro) => {
        const bloqueado =
          erro.code === 'P2003' ||
          (
            erro.name === 'PrismaClientUnknownRequestError' &&
            erro.message?.includes('23001') &&
            erro.message?.includes('itens_manutencao_equipamento_id_fkey')
          );

        assert.ok(bloqueado, 'Exclusao do equipamento deveria ser bloqueada.');
        return true;
      },
    );

    assert.ok(
      await db.equipamento.findUnique({
        where: { id: criados.equipamento.id },
      }),
    );

    assert.ok(
      await db.itemManutencao.findUnique({
        where: { id: criados.item.id },
      }),
    );

    assert.ok(
      await db.manutencao.findUnique({
        where: { id: criados.manutencao.id },
      }),
    );

    console.log('Equipamento, item e manutencao preservados corretamente.');
  } finally {
    if (criados.item?.id) {
      await db.itemManutencao.deleteMany({
        where: { id: criados.item.id },
      });
    }

    if (criados.manutencao?.id) {
      await db.manutencao.deleteMany({
        where: { id: criados.manutencao.id },
      });
    }

    if (criados.fornecedor?.id) {
      await db.fornecedor.deleteMany({
        where: { id: criados.fornecedor.id },
      });
    }

    if (criados.equipamento?.id) {
      await db.equipamento.deleteMany({
        where: { id: criados.equipamento.id },
      });
    }

    if (criados.categoria?.id) {
      await db.categoria.deleteMany({
        where: { id: criados.categoria.id },
      });
    }

    if (criados.grupo?.id) {
      await db.grupo.deleteMany({
        where: { id: criados.grupo.id },
      });
    }

    if (criados.marca?.id) {
      await db.marca.deleteMany({
        where: { id: criados.marca.id },
      });
    }

    if (criados.local?.id) {
      await db.local.deleteMany({
        where: { id: criados.local.id },
      });
    }

    if (criados.predio?.id) {
      await db.predio.deleteMany({
        where: { id: criados.predio.id },
      });
    }
  }
});

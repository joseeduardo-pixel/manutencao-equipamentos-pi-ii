import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const EXPECTED_DATABASE = 'mydb_test_pi2';

test('Usuario comum nao pode reabrir manutencao', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');
  assert.ok(
    process.env.JWT_ACCESS_SECRET,
    'JWT_ACCESS_SECRET nao configurado',
  );

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

  const { default: app } = await import('../../src/app.js');

  let usuario = null;

  try {
    const identificador = Date.now();

    usuario = await db.user.create({
      data: {
        name: 'Usuario Teste Reabertura',
        username: `user_reabertura_${identificador}`,
        email: `user_reabertura_${identificador}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    const token = jwt.sign(
      { id: usuario.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/api/v1/manutencoes/999999/reabrir',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        justificativa:
          'Solicitacao de reabertura para teste de permissao.',
      },
    });

    assert.equal(
      resposta.statusCode,
      403,
      `Usuario comum deveria ser bloqueado: ${resposta.body}`,
    );

    console.log(
      'Bloqueio de reabertura por usuario comum validado.',
    );
  } finally {
    if (usuario?.id) {
      await db.user.delete({
        where: { id: usuario.id },
      });
    }
  }
});

for (const perfil of ['admin', 'root']) {
test(`Perfil ${perfil} reabre manutencao com auditoria`, async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');
  assert.ok(process.env.JWT_ACCESS_SECRET);

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

  const banco = await db.$queryRaw`
    SELECT current_database() AS banco
  `;

  assert.equal(banco[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  let administrador = null;
  let fornecedor = null;
  let manutencao = null;

  try {
    const identificador = `PI2-REAB-${Date.now()}`;

  administrador = await db.user.create({
    data: {
      name: 'Administrador Teste Reabertura',
      username: `${perfil}_reab_${Date.now()}`,
      email: `${perfil}_reab_${Date.now()}@example.com`,
      password: 'SenhaTemporariaTeste123!',
      role: perfil,
      status: 'active',
    },
  });

  fornecedor = await db.fornecedor.create({
    data: {
      razao_social: `Fornecedor ${identificador}`,
      cnpj: `${Date.now()}`.padStart(14, '0'),
    },
  });

  manutencao = await db.manutencao.create({
    data: {
      data: new Date('2026-10-22T12:00:00Z'),
      nota_fiscal: `NF-${identificador}`,
      solicitacao: 1001,
      finalizado: true,
      fornecedor_id: fornecedor.id,
      observacoes: 'Manutencao ficticia finalizada.',
    },
  });

  const token = jwt.sign(
    { id: administrador.id },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  );

  const justificativa =
    'Reabertura autorizada para validar a auditoria do sistema.';

  const resposta = await app.inject({
    method: 'PATCH',
    url: `/api/v1/manutencoes/${manutencao.id}/reabrir`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      justificativa,
    },
  });

  assert.equal(
    resposta.statusCode,
    200,
    `Falha na reabertura: ${resposta.body}`,
  );

  const registro = await db.manutencao.findUnique({
    where: { id: manutencao.id },
  });

  assert.equal(registro.finalizado, false);

  const auditorias = await db.auditoriaReaberturaManutencao.findMany({
    where: {
      manutencao_id: manutencao.id,
    },
  });

  assert.equal(auditorias.length, 1);

  assert.equal(
    auditorias[0].usuario_id,
    administrador.id,
  );

  assert.equal(
    auditorias[0].justificativa,
    justificativa,
  );

  assert.ok(auditorias[0].data_reabertura);

  console.log('Reabertura administrativa validada.');
  console.log('Auditoria registrada corretamente.');
  console.log('Manutencao de teste:', manutencao.id);

  // Uma manutencao ja aberta nao pode ser reaberta novamente.
  const segundaResposta = await app.inject({
    method: 'PATCH',
    url: `/api/v1/manutencoes/${manutencao.id}/reabrir`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      justificativa:
        'Segunda tentativa de reabertura para validar bloqueio.',
    },
  });

  assert.equal(
    segundaResposta.statusCode,
    409,
    `Reabertura duplicada deveria ser bloqueada: ${segundaResposta.body}`,
  );

  const auditoriasDepois = await db.auditoriaReaberturaManutencao.count({
    where: {
      manutencao_id: manutencao.id,
    },
  });

  assert.equal(
    auditoriasDepois,
    1,
    'Reabertura duplicada nao pode gerar outra auditoria.',
  );

  const manutencaoDepois = await db.manutencao.findUnique({
    where: {
      id: manutencao.id,
    },
  });

  assert.equal(
    manutencaoDepois.finalizado,
    false,
    'A manutencao deve continuar aberta.',
  );

  console.log('Reabertura duplicada bloqueada com HTTP 409.');
  console.log('Auditoria preservada sem duplicacao.');

  // Finalizar novamente a manutencao apos a reabertura.
  const respostaFinalizacao = await app.inject({
    method: 'PATCH',
    url: `/api/v1/manutencoes/${manutencao.id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      finalizado: true,
    },
  });

  assert.equal(
    respostaFinalizacao.statusCode,
    200,
    `Nova finalizacao deveria ser permitida: ${respostaFinalizacao.body}`,
  );

  const manutencaoFinalizada = await db.manutencao.findUnique({
    where: {
      id: manutencao.id,
    },
  });

  assert.equal(
    manutencaoFinalizada.finalizado,
    true,
    'A manutencao deve estar finalizada novamente.',
  );

  const auditoriasAposFinalizacao =
    await db.auditoriaReaberturaManutencao.findMany({
      where: {
        manutencao_id: manutencao.id,
      },
    });

  assert.equal(
    auditoriasAposFinalizacao.length,
    1,
    'A auditoria deve ser preservada apos nova finalizacao.',
  );

  assert.equal(
    auditoriasAposFinalizacao[0].usuario_id,
    administrador.id,
    'O responsavel pela reabertura deve permanecer registrado.',
  );

  console.log('Nova finalizacao aprovada com HTTP 200.');
  console.log('Auditoria preservada apos nova finalizacao.');

  // A atualizacao comum nao pode reabrir manutencoes.
  const respostaReaberturaComum = await app.inject({
    method: 'PATCH',
    url: `/api/v1/manutencoes/${manutencao.id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      finalizado: false,
    },
  });

  assert.equal(
    respostaReaberturaComum.statusCode,
    409,
    `Reabertura comum deveria ser bloqueada: ${respostaReaberturaComum.body}`,
  );

  const manutencaoProtegida = await db.manutencao.findUnique({
    where: {
      id: manutencao.id,
    },
  });

  assert.equal(
    manutencaoProtegida.finalizado,
    true,
    'A manutencao deve permanecer finalizada.',
  );

  const auditoriasPreservadas =
    await db.auditoriaReaberturaManutencao.count({
      where: {
        manutencao_id: manutencao.id,
      },
    });

  assert.equal(
    auditoriasPreservadas,
    1,
    'A tentativa comum nao deve modificar as auditorias.',
  );

  console.log('Reabertura pela rota comum bloqueada com HTTP 409.');
  console.log('Manutencao finalizada e auditoria preservadas.');

  } finally {
    if (manutencao?.id) {
      await db.auditoriaReaberturaManutencao.deleteMany({
        where: {
          manutencao_id: manutencao.id,
        },
      });

      await db.manutencao.delete({
        where: {
          id: manutencao.id,
        },
      });
    }

    if (fornecedor?.id) {
      await db.fornecedor.delete({
        where: {
          id: fornecedor.id,
        },
      });
    }

    if (administrador?.id) {
      await db.user.delete({
        where: {
          id: administrador.id,
        },
      });
    }
  }
});
}

test('Validacao de justificativas invalidas', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');
  assert.ok(process.env.JWT_ACCESS_SECRET);

  const url = new URL(databaseUrl);

  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '5435');

  assert.equal(
    decodeURIComponent(url.pathname.slice(1)),
    EXPECTED_DATABASE,
    'Banco nao autorizado',
  );

  assert.equal(process.env.NODE_ENV, 'test');

  const { default: db } = await import('../../src/config/db.js');

  const banco = await db.$queryRaw`
    SELECT current_database() AS banco
  `;

  assert.equal(banco[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  let administrador = null;

  try {
    const identificador = `${Date.now()}_${process.pid}`;

    administrador = await db.user.create({
      data: {
        name: 'Administrador Teste Justificativas',
        username: `admin_just_${identificador}`,
        email: `admin_just_${identificador}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    const token = jwt.sign(
      { id: administrador.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const manutencaoInexistente = 999999999;

    const auditoriasAntes =
      await db.auditoriaReaberturaManutencao.count({
        where: {
          manutencao_id: manutencaoInexistente,
        },
      });

    const casos = [
      {
        descricao: 'Justificativa ausente',
        payload: {},
      },
      {
        descricao: 'Justificativa muito curta',
        payload: {
          justificativa: 'Curta',
        },
      },
      {
        descricao: 'Justificativa somente com espacos',
        payload: {
          justificativa: '               ',
        },
      },
    ];

    for (const caso of casos) {
      const resposta = await app.inject({
        method: 'PATCH',
        url: `/api/v1/manutencoes/${manutencaoInexistente}/reabrir`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: caso.payload,
      });

      assert.equal(
        resposta.statusCode,
        400,
        `${caso.descricao}: ${resposta.body}`,
      );

      console.log(`${caso.descricao}: bloqueada.`);
    }

    const auditoriasDepois =
      await db.auditoriaReaberturaManutencao.count({
        where: {
          manutencao_id: manutencaoInexistente,
        },
      });

    assert.equal(
      auditoriasDepois,
      auditoriasAntes,
      'Tentativas invalidas nao devem criar auditorias.',
    );

    console.log('Validacoes de justificativa aprovadas.');
  } finally {
    if (administrador?.id) {
      await db.user.delete({
        where: {
          id: administrador.id,
        },
      });
    }
  }
});

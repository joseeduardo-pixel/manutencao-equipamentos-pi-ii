import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const EXPECTED_DATABASE = 'mydb_test_pi2';

test('API gerencia predios no banco de testes', async () => {
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

  assert.ok(
    process.env.JWT_ACCESS_SECRET,
    'JWT_ACCESS_SECRET nao configurado',
  );

  const { default: db } = await import('../../src/config/db.js');

  const resultado = await db.$queryRaw`
    SELECT current_database() AS banco
  `;

  assert.equal(resultado[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  const identificador = `PI2-AUX-${Date.now()}`;

  const criados = {
    predio: null,
    administrador: null,
    usuarioComum: null,
  };

  try {
    criados.administrador = await db.user.create({
      data: {
        name: 'Administrador Teste Auxiliares',
        username: `admin_aux_${Date.now()}`,
        email: `admin_aux_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    criados.usuarioComum = await db.user.create({
      data: {
        name: 'Usuario Comum Teste Auxiliares',
        username: `comum_aux_${Date.now()}`,
        email: `comum_aux_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    const tokenAdmin = jwt.sign(
      { id: criados.administrador.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const tokenComum = jwt.sign(
      { id: criados.usuarioComum.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const headersAdmin = {
      authorization: `Bearer ${tokenAdmin}`,
    };

    const headersComum = {
      authorization: `Bearer ${tokenComum}`,
    };

    // Cadastro de predio
    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/auxiliares/predios',
      headers: headersAdmin,
      payload: {
        nome_predio: `Predio ${identificador}`,
        descricao: 'Registro ficticio para teste de integracao',
      },
    });

    assert.equal(
      cadastro.statusCode,
      201,
      `Falha no cadastro: ${cadastro.body}`,
    );

    const predio = cadastro.json().data;

    assert.ok(predio?.id, 'ID do predio nao retornado');

    criados.predio = predio.id;

    // Consulta por ID
    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/predios/${predio.id}`,
      headers: headersAdmin,
    });

    assert.equal(
      consulta.statusCode,
      200,
      `Falha na consulta: ${consulta.body}`,
    );

    assert.equal(consulta.json().data.id, predio.id);

    // Atualizacao
    const novoNome = `Predio Atualizado ${identificador}`;

    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/auxiliares/predios/${predio.id}`,
      headers: headersAdmin,
      payload: {
        nome_predio: novoNome,
      },
    });

    assert.equal(
      atualizacao.statusCode,
      200,
      `Falha na atualizacao: ${atualizacao.body}`,
    );

    assert.equal(atualizacao.json().data.nome_predio, novoNome);

    // Confirmacao da persistencia no PostgreSQL
    const predioAtualizado = await db.predio.findUnique({
      where: { id: predio.id },
    });

    assert.equal(predioAtualizado.nome_predio, novoNome);

    // Pesquisa pelo nome
    const pesquisa = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/predios?search=${encodeURIComponent(identificador)}`,
      headers: headersAdmin,
    });

    assert.equal(
      pesquisa.statusCode,
      200,
      `Falha na pesquisa: ${pesquisa.body}`,
    );

    assert.ok(
      pesquisa.json().data.some((item) => item.id === predio.id),
      'Predio nao encontrado na pesquisa',
    );

    // Usuario comum nao pode excluir
    const exclusaoNegada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/predios/${predio.id}`,
      headers: headersComum,
    });

    assert.equal(
      exclusaoNegada.statusCode,
      403,
      `Exclusao deveria ser negada: ${exclusaoNegada.body}`,
    );

    assert.ok(
      await db.predio.findUnique({ where: { id: predio.id } }),
      'Predio excluido indevidamente',
    );

    // Administrador pode excluir
    const exclusaoAutorizada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/predios/${predio.id}`,
      headers: headersAdmin,
    });

    assert.equal(
      exclusaoAutorizada.statusCode,
      200,
      `Falha na exclusao: ${exclusaoAutorizada.body}`,
    );

    assert.equal(
      await db.predio.findUnique({ where: { id: predio.id } }),
      null,
      'Predio continua no banco apos exclusao',
    );

    criados.predio = null;

    console.log('CRUD de predios validado com sucesso.');
    console.log('Pesquisa e permissoes validadas.');
    console.log('Persistencia no PostgreSQL confirmada.');
  } finally {
    // Limpeza limitada aos registros ficticios deste teste.
    // deleteMany permite repetir a limpeza sem erro por ID ausente.
    if (criados.predio) {
      await db.predio.deleteMany({
        where: { id: criados.predio },
      });
    }

    if (criados.usuarioComum) {
      await db.user.deleteMany({
        where: { id: criados.usuarioComum.id },
      });
    }

    if (criados.administrador) {
      await db.user.deleteMany({
        where: { id: criados.administrador.id },
      });
    }
  }
});


import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const EXPECTED_DATABASE = 'mydb_test_pi2';

test('API cadastra e consulta equipamento no banco de testes', async () => {
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

  const criados = {
    equipamento: null,
    usuario: null,
    categoria: null,
    grupo: null,
    marca: null,
    local: null,
    predio: null,
  };

  try {
    const identificador = `TESTE-PI2-${Date.now()}`;

    criados.predio = await db.predio.create({
      data: {
        nome_predio: `Predio ${identificador}`,
      },
    });

    criados.local = await db.local.create({
      data: {
        nome_local: `Local ${identificador}`,
        predio_id: criados.predio.id,
      },
    });

    criados.grupo = await db.grupo.create({
      data: {
        nome_grupo: `Grupo ${identificador}`,
      },
    });

    criados.categoria = await db.categoria.create({
      data: {
        nome_categoria: `Categoria ${identificador}`,
        grupo_id: criados.grupo.id,
      },
    });

    criados.marca = await db.marca.create({
      data: {
        marca: `Marca ${identificador}`,
      },
    });

    criados.usuario = await db.user.create({
      data: {
        name: 'Usuario Teste Integracao',
        username: `teste_${Date.now()}`,
        email: `teste_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    const token = jwt.sign(
      { id: criados.usuario.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const patrimonio = `PI2-${Date.now()}`;

    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/equipamentos',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        patrimonio,
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

    assert.equal(
      cadastro.statusCode,
      201,
      `Falha no cadastro: ${cadastro.body}`,
    );

    const equipamento = cadastro.json().data;

    assert.ok(equipamento?.id, 'ID do equipamento nao retornado');

    criados.equipamento = equipamento.id;

    assert.equal(equipamento.patrimonio, patrimonio);

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/equipamentos/${equipamento.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(
      consulta.statusCode,
      200,
      `Falha na consulta: ${consulta.body}`,
    );


    assert.equal(consulta.json().data.patrimonio, patrimonio);

    // Teste de atualizacao do equipamento
    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/equipamentos/${equipamento.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        situacao: 'Em Manutencao',
        valor_bem: 4200,
      },
    });

    assert.equal(
      atualizacao.statusCode,
      200,
      `Falha na atualizacao: ${atualizacao.body}`,
    );

    assert.equal(
      atualizacao.json().data.situacao,
      'Em Manutencao',
    );

    assert.equal(
      Number(atualizacao.json().data.valor_bem),
      4200,
    );

    // Confirma que a atualizacao foi persistida no PostgreSQL
    const equipamentoAtualizado = await db.equipamento.findUnique({
      where: { id: equipamento.id },
    });

    assert.equal(equipamentoAtualizado.situacao, 'Em Manutencao');
    assert.equal(Number(equipamentoAtualizado.valor_bem), 4200);

    console.log('Atualizacao do equipamento validada.');

    // Usuario comum nao pode excluir equipamentos
    const usuarioComum = await db.user.create({
      data: {
        name: 'Usuario Comum Teste',
        username: `comum_${Date.now()}`,
        email: `comum_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    criados.usuarioComum = usuarioComum;

    const tokenComum = jwt.sign(
      { id: usuarioComum.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const exclusaoNegada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/equipamentos/${equipamento.id}`,
      headers: {
        authorization: `Bearer ${tokenComum}`,
      },
    });

    assert.equal(
      exclusaoNegada.statusCode,
      403,
      `Exclusao deveria ser negada: ${exclusaoNegada.body}`,
    );

    const equipamentoPreservado = await db.equipamento.findUnique({
      where: { id: equipamento.id },
    });

    assert.ok(
      equipamentoPreservado,
      'Equipamento foi excluido indevidamente',
    );

    console.log('Permissao de exclusao validada.');

    // Pesquisa pelo patrimonio
    const pesquisa = await app.inject({
      method: 'GET',
      url: `/api/v1/equipamentos?search=${encodeURIComponent(patrimonio)}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(
      pesquisa.statusCode,
      200,
      `Falha na pesquisa: ${pesquisa.body}`,
    );

    assert.ok(
      pesquisa.json().data.some(
        (item) => item.id === equipamento.id,
      ),
      'Equipamento nao encontrado pela pesquisa',
    );

    console.log('Pesquisa por patrimonio validada.');

    // Filtro pela situacao atualizada
    const filtro = await app.inject({
      method: 'GET',
      url: '/api/v1/equipamentos?situacao=Em%20Manutencao',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(
      filtro.statusCode,
      200,
      `Falha no filtro: ${filtro.body}`,
    );

    assert.ok(
      filtro.json().data.some(
        (item) => item.id === equipamento.id,
      ),
      'Equipamento nao encontrado no filtro de situacao',
    );

    console.log('Filtro por situacao validado.');

    // Paginacao com limite de um equipamento
    const paginacao = await app.inject({
      method: 'GET',
      url: '/api/v1/equipamentos?page=1&limit=1',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(
      paginacao.statusCode,
      200,
      `Falha na paginacao: ${paginacao.body}`,
    );

    assert.ok(
      Array.isArray(paginacao.json().data),
      'Resposta da paginacao nao contem uma lista',
    );

    assert.ok(
      paginacao.json().data.length <= 1,
      'Paginacao retornou mais registros que o limite',
    );

    console.log('Paginacao validada.');


    // Administrador pode excluir equipamentos
    const exclusaoAutorizada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/equipamentos/${equipamento.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(
      exclusaoAutorizada.statusCode,
      200,
      `Falha na exclusao autorizada: ${exclusaoAutorizada.body}`,
    );

    const equipamentoExcluido = await db.equipamento.findUnique({
      where: { id: equipamento.id },
    });

    assert.equal(
      equipamentoExcluido,
      null,
      'Equipamento continua no banco apos exclusao',
    );

    // Evita tentar excluir novamente no bloco finally
    criados.equipamento = null;

    console.log('Exclusao autorizada e confirmada no PostgreSQL.');


  } finally {
    if (criados.usuarioComum) {
      await db.user.delete({
        where: { id: criados.usuarioComum.id },
      });
    }

    if (criados.equipamento) {
      await db.equipamento.delete({
        where: { id: criados.equipamento },
      });
    }

    if (criados.usuario) {
      await db.user.delete({
        where: { id: criados.usuario.id },
      });
    }

    if (criados.categoria) {
      await db.categoria.delete({
        where: { id: criados.categoria.id },
      });
    }

    if (criados.grupo) {
      await db.grupo.delete({
        where: { id: criados.grupo.id },
      });
    }

    if (criados.marca) {
      await db.marca.delete({
        where: { id: criados.marca.id },
      });
    }

    if (criados.local) {
      await db.local.delete({
        where: { id: criados.local.id },
      });
    }

    if (criados.predio) {
      await db.predio.delete({
        where: { id: criados.predio.id },
      });
    }
  }
});

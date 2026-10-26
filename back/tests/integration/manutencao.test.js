import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const EXPECTED_DATABASE = 'mydb_test_pi2';

test('API cadastra consulta e atualiza manutencao', async () => {
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

  const { default: app } = await import('../../src/app.js');

  const criados = {
    usuario: null,
    usuarioComum: null,
    predio: null,
    local: null,
    grupo: null,
    categoria: null,
    marca: null,
    equipamento: null,
    fornecedor: null,
    manutencao: null,
  };

  try {
    const identificador = `TESTE-MAN-${Date.now()}`;

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
        cnpj: String(Date.now()).padStart(14, '0'),
      },
    });

    criados.usuario = await db.user.create({
      data: {
        name: 'Administrador Teste Manutencao',
        username: `admin_man_${Date.now()}`,
        email: `admin_man_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    criados.usuarioComum = await db.user.create({
      data: {
        name: 'Usuario Comum Teste Manutencao',
        username: `user_man_${Date.now()}`,
        email: `user_man_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    const tokenUsuario = jwt.sign(
      { id: criados.usuarioComum.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const headersUsuario = {
      authorization: `Bearer ${tokenUsuario}`,
    };

    const token = jwt.sign(
      { id: criados.usuario.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const headers = {
      authorization: `Bearer ${token}`,
    };

    // Cadastrar manutencao com um item
    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/manutencoes',
      headers,
      payload: {
        data: '2026-10-18',
        nota_fiscal: `NF-${Date.now()}`,
        solicitacao: 1001,
        finalizado: false,
        forma_aquisicao: 'Contrato Direto',
        tipo_manutencao: 'Preventiva',
        observacoes: 'Manutencao ficticia para teste.',
        fornecedor_id: criados.fornecedor.id,
        itens: [
          {
            descricao: 'Limpeza de filtros',
            quantidade: 2,
            valor_unitario: 150,
            equipamento_id: criados.equipamento.id,
          },
        ],
      },
    });

    assert.equal(
      cadastro.statusCode,
      201,
      `Falha no cadastro: ${cadastro.body}`,
    );

    const manutencao = cadastro.json().data;

    assert.ok(manutencao?.id, 'ID da manutencao nao retornado');

    criados.manutencao = manutencao.id;

    assert.equal(manutencao._count.itens, 1);

    console.log('Cadastro de manutencao com item validado.');

    // Consultar manutencao
    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/manutencoes/${manutencao.id}`,
      headers,
    });

    assert.equal(
      consulta.statusCode,
      200,
      `Falha na consulta: ${consulta.body}`,
    );

    assert.equal(
      consulta.json().data.id,
      manutencao.id,
    );

    console.log('Consulta da manutencao validada.');

    // Consultar itens
    const itens = await app.inject({
      method: 'GET',
      url: `/api/v1/manutencoes/${manutencao.id}/itens`,
      headers,
    });

    assert.equal(
      itens.statusCode,
      200,
      `Falha na consulta de itens: ${itens.body}`,
    );

    assert.equal(itens.json().data.length, 1);

    assert.equal(
      itens.json().data[0].descricao,
      'Limpeza de filtros',
    );

    console.log('Consulta dos itens validada.');

    // Adicionar outro item
    const novoItem = await app.inject({
      method: 'POST',
      url: `/api/v1/manutencoes/${manutencao.id}/itens`,
      headers,
      payload: {
        descricao: 'Substituicao de capacitor',
        quantidade: 1,
        valor_unitario: 240,
        equipamento_id: criados.equipamento.id,
      },
    });

    assert.equal(
      novoItem.statusCode,
      201,
      `Falha ao adicionar item: ${novoItem.body}`,
    );

    const itemId = novoItem.json().data.id;

    assert.ok(itemId);

    console.log('Inclusao de item validada.');

    // Atualizar item
    const atualizarItem = await app.inject({
      method: 'PATCH',
      url: `/api/v1/manutencoes/${manutencao.id}/itens/${itemId}`,
      headers,
      payload: {
        quantidade: 2,
        valor_unitario: 220,
      },
    });

    assert.equal(
      atualizarItem.statusCode,
      200,
      `Falha ao atualizar item: ${atualizarItem.body}`,
    );

    const itemAtualizado = await db.itemManutencao.findUnique({
      where: { id: itemId },
    });

    assert.equal(Number(itemAtualizado.quantidade), 2);
    assert.equal(Number(itemAtualizado.valor_unitario), 220);

    console.log('Atualizacao de item validada.');

    // Usuario comum nao pode excluir item
    const exclusaoNegadaItem = await app.inject({
      method: 'DELETE',
      url: `/api/v1/manutencoes/${manutencao.id}/itens/${itemId}`,
      headers: headersUsuario,
    });

    assert.equal(exclusaoNegadaItem.statusCode, 403);

    assert.ok(
      await db.itemManutencao.findUnique({
        where: { id: itemId },
      }),
    );

    console.log('Bloqueio de exclusao de item validado.');

    // Administrador pode excluir item
    const exclusaoItem = await app.inject({
      method: 'DELETE',
      url: `/api/v1/manutencoes/${manutencao.id}/itens/${itemId}`,
      headers,
    });

    assert.equal(
      exclusaoItem.statusCode,
      200,
      `Falha ao excluir item: ${exclusaoItem.body}`,
    );

    assert.equal(
      await db.itemManutencao.findUnique({
        where: { id: itemId },
      }),
      null,
    );

    console.log('Exclusao de item por administrador validada.');

    // Atualizar manutencao
    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/manutencoes/${manutencao.id}`,
      headers,
      payload: {
        finalizado: true,
        observacoes: 'Manutencao concluida durante o teste.',
      },
    });

    assert.equal(
      atualizacao.statusCode,
      200,
      `Falha na atualizacao: ${atualizacao.body}`,
    );

    const registroAtualizado = await db.manutencao.findUnique({
      where: { id: manutencao.id },
    });

    assert.equal(registroAtualizado.finalizado, true);

    assert.equal(
      registroAtualizado.observacoes,
      'Manutencao concluida durante o teste.',
    );

    console.log('Atualizacao e persistencia validadas.');

    // Usuario comum nao pode excluir manutencao
    const exclusaoNegadaManutencao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/manutencoes/${manutencao.id}`,
      headers: headersUsuario,
    });

    assert.equal(exclusaoNegadaManutencao.statusCode, 403);

    assert.ok(
      await db.manutencao.findUnique({
        where: { id: manutencao.id },
      }),
    );

    console.log('Bloqueio de exclusao de manutencao validado.');



    // Administrador nao pode excluir manutencao finalizada
    const exclusaoManutencao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/manutencoes/${manutencao.id}`,
      headers,
    });

    assert.equal(
      exclusaoManutencao.statusCode,
      409,
      `A exclusao deveria ser bloqueada: ${exclusaoManutencao.body}`,
    );

    const manutencaoPreservada = await db.manutencao.findUnique({
      where: { id: manutencao.id },
    });

    assert.ok(
      manutencaoPreservada,
      'A manutencao finalizada deve continuar cadastrada.',
    );

    assert.equal(manutencaoPreservada.finalizado, true);

    console.log('Exclusao de manutencao finalizada bloqueada.');

    // Administrador nao pode editar manutencao finalizada
    const edicaoBloqueada = await app.inject({
      method: 'PATCH',
      url: `/api/v1/manutencoes/${manutencao.id}`,
      headers,
      payload: {
        observacoes: 'Alteracao indevida apos finalizacao.',
      },
    });

    assert.equal(
      edicaoBloqueada.statusCode,
      409,
      `A edicao deveria ser bloqueada: ${edicaoBloqueada.body}`,
    );

    // A reabertura nao pode ocorrer pelo PATCH comum
    const reaberturaBloqueada = await app.inject({
      method: 'PATCH',
      url: `/api/v1/manutencoes/${manutencao.id}`,
      headers,
      payload: {
        finalizado: false,
      },
    });

    assert.equal(
      reaberturaBloqueada.statusCode,
      409,
      `A reabertura deveria ser bloqueada: ${reaberturaBloqueada.body}`,
    );

    // Confirmar que os dados originais foram preservados
    const manutencaoAposTentativas = await db.manutencao.findUnique({
      where: { id: manutencao.id },
    });

    assert.ok(manutencaoAposTentativas);

    assert.equal(manutencaoAposTentativas.finalizado, true);

    assert.equal(
      manutencaoAposTentativas.observacoes,
      'Manutencao concluida durante o teste.',
    );

    console.log('Edicao e reabertura indevidas bloqueadas.');

    // Bloquear inclusao de item em manutencao finalizada
    const inclusaoBloqueada = await app.inject({
      method: 'POST',
      url: `/api/v1/manutencoes/${manutencao.id}/itens`,
      headers,
      payload: {
        descricao: 'Item inserido indevidamente',
        quantidade: 1,
        valor_unitario: 100,
        equipamento_id: criados.equipamento.id,
      },
    });

    assert.equal(
      inclusaoBloqueada.statusCode,
      409,
      `A inclusao deveria ser bloqueada: ${inclusaoBloqueada.body}`,
    );

    // Localizar o item original da manutencao
    const itemOriginal = await db.itemManutencao.findFirst({
      where: { manutencao_id: manutencao.id },
    });

    assert.ok(itemOriginal, 'O item original deve existir.');

    // Bloquear edicao de item em manutencao finalizada
    const edicaoItemBloqueada = await app.inject({
      method: 'PATCH',
      url: `/api/v1/manutencoes/${manutencao.id}/itens/${itemOriginal.id}`,
      headers,
      payload: {
        descricao: 'Descricao alterada indevidamente',
      },
    });

    assert.equal(
      edicaoItemBloqueada.statusCode,
      409,
      `A edicao do item deveria ser bloqueada: ${edicaoItemBloqueada.body}`,
    );

    // Bloquear exclusao de item em manutencao finalizada
    const exclusaoItemBloqueada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/manutencoes/${manutencao.id}/itens/${itemOriginal.id}`,
      headers,
    });

    assert.equal(
      exclusaoItemBloqueada.statusCode,
      409,
      `A exclusao do item deveria ser bloqueada: ${exclusaoItemBloqueada.body}`,
    );

    // Verificar se o item original foi preservado
    const itemPreservado = await db.itemManutencao.findUnique({
      where: { id: itemOriginal.id },
    });

    assert.ok(itemPreservado);

    assert.equal(
      itemPreservado.descricao,
      itemOriginal.descricao,
    );

    const quantidadeItens = await db.itemManutencao.count({
      where: { manutencao_id: manutencao.id },
    });

    assert.equal(quantidadeItens, 1);

    console.log('Itens de manutencao finalizada protegidos.');

  } finally {
    if (criados.manutencao) {
      await db.itemManutencao.deleteMany({
        where: { manutencao_id: criados.manutencao },
      });

      await db.manutencao.delete({
        where: { id: criados.manutencao },
      });
    }

    if (criados.usuarioComum) {
      await db.user.delete({
        where: { id: criados.usuarioComum.id },
      });
    }
    if (criados.usuario) {
      await db.user.delete({
        where: { id: criados.usuario.id },
      });
    }

    if (criados.fornecedor) {
      await db.fornecedor.delete({
        where: { id: criados.fornecedor.id },
      });
    }

    if (criados.equipamento) {
      await db.equipamento.delete({
        where: { id: criados.equipamento.id },
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

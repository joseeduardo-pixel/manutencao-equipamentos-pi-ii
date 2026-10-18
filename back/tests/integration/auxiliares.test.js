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

test('API gerencia locais vinculados a predios', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');

  const url = new URL(databaseUrl);
  assert.equal(decodeURIComponent(url.pathname.slice(1)), EXPECTED_DATABASE);
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(process.env.JWT_ACCESS_SECRET);

  const { default: db } = await import('../../src/config/db.js');

  const resultado = await db.$queryRaw`
    SELECT current_database() AS banco
  `;
  assert.equal(resultado[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  const identificador = `PI2-LOCAL-${Date.now()}`;
  let usuario = null;
  let predio = null;
  let local = null;

  try {
    usuario = await db.user.create({
      data: {
        name: 'Administrador Teste Local',
        username: `admin_local_${Date.now()}`,
        email: `admin_local_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    const token = jwt.sign(
      { id: usuario.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const headers = {
      authorization: `Bearer ${token}`,
    };

    predio = await db.predio.create({
      data: {
        nome_predio: `Predio ${identificador}`,
      },
    });

    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/auxiliares/locais',
      headers,
      payload: {
        nome_local: `Sala ${identificador}`,
        predio_id: predio.id,
      },
    });

    assert.equal(cadastro.statusCode, 201, cadastro.body);

    local = cadastro.json().data;
    assert.ok(local?.id);
    assert.equal(local.predio_id, predio.id);

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/locais/${local.id}`,
      headers,
    });

    assert.equal(consulta.statusCode, 200, consulta.body);
    assert.equal(consulta.json().data.id, local.id);
    assert.equal(consulta.json().data.predio.id, predio.id);

    const novoNome = `Laboratorio ${identificador}`;

    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/auxiliares/locais/${local.id}`,
      headers,
      payload: {
        nome_local: novoNome,
      },
    });

    assert.equal(atualizacao.statusCode, 200, atualizacao.body);

    const registro = await db.local.findUnique({
      where: { id: local.id },
    });

    assert.equal(registro.nome_local, novoNome);

    const filtro = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/locais?predio_id=${predio.id}`,
      headers,
    });

    assert.equal(filtro.statusCode, 200, filtro.body);
    assert.ok(
      filtro.json().data.some((item) => item.id === local.id),
      'Local nao encontrado no filtro por predio',
    );

    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/locais/${local.id}`,
      headers,
    });

    assert.equal(exclusao.statusCode, 200, exclusao.body);

    assert.equal(
      await db.local.findUnique({ where: { id: local.id } }),
      null,
    );

    local = null;

    console.log('CRUD de locais e filtro por predio validados.');
  } finally {
    if (local?.id) {
      await db.local.deleteMany({ where: { id: local.id } });
    }

    if (predio?.id) {
      await db.predio.deleteMany({ where: { id: predio.id } });
    }

    if (usuario?.id) {
      await db.user.deleteMany({ where: { id: usuario.id } });
    }
  }
});

test('API gerencia grupos de categorias', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');

  const url = new URL(databaseUrl);
  assert.equal(decodeURIComponent(url.pathname.slice(1)), EXPECTED_DATABASE);
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(process.env.JWT_ACCESS_SECRET);

  const { default: db } = await import('../../src/config/db.js');

  const resultado = await db.$queryRaw`
    SELECT current_database() AS banco
  `;
  assert.equal(resultado[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  const identificador = `PI2-GRUPO-${Date.now()}`;
  let administrador = null;
  let usuarioComum = null;
  let grupo = null;

  try {
    administrador = await db.user.create({
      data: {
        name: 'Administrador Teste Grupo',
        username: `admin_grupo_${Date.now()}`,
        email: `admin_grupo_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    usuarioComum = await db.user.create({
      data: {
        name: 'Usuario Comum Teste Grupo',
        username: `comum_grupo_${Date.now()}`,
        email: `comum_grupo_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    const headersAdmin = {
      authorization: `Bearer ${jwt.sign(
        { id: administrador.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    const headersComum = {
      authorization: `Bearer ${jwt.sign(
        { id: usuarioComum.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/auxiliares/grupos',
      headers: headersAdmin,
      payload: {
        nome_grupo: `Grupo ${identificador}`,
      },
    });

    assert.equal(cadastro.statusCode, 201, cadastro.body);

    grupo = cadastro.json().data;
    assert.ok(grupo?.id);

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/grupos/${grupo.id}`,
      headers: headersAdmin,
    });

    assert.equal(consulta.statusCode, 200, consulta.body);
    assert.equal(consulta.json().data.id, grupo.id);

    const novoNome = `Grupo Atualizado ${identificador}`;

    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/auxiliares/grupos/${grupo.id}`,
      headers: headersAdmin,
      payload: {
        nome_grupo: novoNome,
      },
    });

    assert.equal(atualizacao.statusCode, 200, atualizacao.body);

    const registro = await db.grupo.findUnique({
      where: { id: grupo.id },
    });

    assert.equal(registro.nome_grupo, novoNome);

    const pesquisa = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/grupos?search=${encodeURIComponent(identificador)}`,
      headers: headersAdmin,
    });

    assert.equal(pesquisa.statusCode, 200, pesquisa.body);
    assert.ok(
      pesquisa.json().data.some((item) => item.id === grupo.id),
      'Grupo nao encontrado na pesquisa',
    );

    const exclusaoNegada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/grupos/${grupo.id}`,
      headers: headersComum,
    });

    assert.equal(exclusaoNegada.statusCode, 403, exclusaoNegada.body);

    assert.ok(
      await db.grupo.findUnique({ where: { id: grupo.id } }),
      'Grupo excluido por usuario sem permissao',
    );

    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/grupos/${grupo.id}`,
      headers: headersAdmin,
    });

    assert.equal(exclusao.statusCode, 200, exclusao.body);

    assert.equal(
      await db.grupo.findUnique({ where: { id: grupo.id } }),
      null,
    );

    grupo = null;

    console.log('CRUD de grupos, pesquisa e permissoes validados.');
  } finally {
    if (grupo?.id) {
      await db.grupo.deleteMany({ where: { id: grupo.id } });
    }

    if (usuarioComum?.id) {
      await db.user.deleteMany({
        where: { id: usuarioComum.id },
      });
    }

    if (administrador?.id) {
      await db.user.deleteMany({
        where: { id: administrador.id },
      });
    }
  }
});

test('API gerencia categorias vinculadas a grupos', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');

  const url = new URL(databaseUrl);
  assert.equal(
    decodeURIComponent(url.pathname.slice(1)),
    EXPECTED_DATABASE,
    'Banco de dados nao autorizado',
  );
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(process.env.JWT_ACCESS_SECRET);

  const { default: db } = await import('../../src/config/db.js');

  const resultado = await db.$queryRaw`
    SELECT current_database() AS banco
  `;
  assert.equal(resultado[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  const identificador = `PI2-CATEGORIA-${Date.now()}`;
  let administrador = null;
  let usuarioComum = null;
  let grupo = null;
  let categoria = null;

  try {
    administrador = await db.user.create({
      data: {
        name: 'Administrador Teste Categoria',
        username: `admin_cat_${Date.now()}`,
        email: `admin_cat_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    usuarioComum = await db.user.create({
      data: {
        name: 'Usuario Comum Teste Categoria',
        username: `comum_cat_${Date.now()}`,
        email: `comum_cat_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    const headersAdmin = {
      authorization: `Bearer ${jwt.sign(
        { id: administrador.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    const headersComum = {
      authorization: `Bearer ${jwt.sign(
        { id: usuarioComum.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    grupo = await db.grupo.create({
      data: {
        nome_grupo: `Grupo ${identificador}`,
      },
    });

    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/auxiliares/categorias',
      headers: headersAdmin,
      payload: {
        nome_categoria: `Categoria ${identificador}`,
        grupo_id: grupo.id,
      },
    });

    assert.equal(cadastro.statusCode, 201, cadastro.body);

    categoria = cadastro.json().data;
    assert.ok(categoria?.id);
    assert.equal(categoria.grupo_id, grupo.id);

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/categorias/${categoria.id}`,
      headers: headersAdmin,
    });

    assert.equal(consulta.statusCode, 200, consulta.body);
    assert.equal(consulta.json().data.id, categoria.id);
    assert.equal(consulta.json().data.grupo.id, grupo.id);

    const novoNome = `Categoria Atualizada ${identificador}`;

    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/auxiliares/categorias/${categoria.id}`,
      headers: headersAdmin,
      payload: {
        nome_categoria: novoNome,
      },
    });

    assert.equal(atualizacao.statusCode, 200, atualizacao.body);

    const registro = await db.categoria.findUnique({
      where: { id: categoria.id },
    });

    assert.equal(registro.nome_categoria, novoNome);
    assert.equal(registro.grupo_id, grupo.id);

    const filtro = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/categorias?grupo_id=${grupo.id}`,
      headers: headersAdmin,
    });

    assert.equal(filtro.statusCode, 200, filtro.body);
    assert.ok(
      filtro.json().data.some((item) => item.id === categoria.id),
      'Categoria nao encontrada no filtro por grupo',
    );

    const pesquisa = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/categorias?search=${encodeURIComponent(identificador)}`,
      headers: headersAdmin,
    });

    assert.equal(pesquisa.statusCode, 200, pesquisa.body);
    assert.ok(
      pesquisa.json().data.some((item) => item.id === categoria.id),
      'Categoria nao encontrada na pesquisa',
    );

    const exclusaoNegada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/categorias/${categoria.id}`,
      headers: headersComum,
    });

    assert.equal(
      exclusaoNegada.statusCode,
      403,
      exclusaoNegada.body,
    );

    assert.ok(
      await db.categoria.findUnique({
        where: { id: categoria.id },
      }),
      'Categoria excluida por usuario sem permissao',
    );

    const exclusaoAutorizada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/categorias/${categoria.id}`,
      headers: headersAdmin,
    });

    assert.equal(
      exclusaoAutorizada.statusCode,
      200,
      exclusaoAutorizada.body,
    );

    assert.equal(
      await db.categoria.findUnique({
        where: { id: categoria.id },
      }),
      null,
    );

    categoria = null;

    console.log('CRUD de categorias validado.');
    console.log('Relacionamento com grupos confirmado.');
    console.log('Filtros, pesquisa e permissoes validados.');
  } finally {
    if (categoria?.id) {
      await db.categoria.deleteMany({
        where: { id: categoria.id },
      });
    }

    if (grupo?.id) {
      await db.grupo.deleteMany({
        where: { id: grupo.id },
      });
    }

    if (usuarioComum?.id) {
      await db.user.deleteMany({
        where: { id: usuarioComum.id },
      });
    }

    if (administrador?.id) {
      await db.user.deleteMany({
        where: { id: administrador.id },
      });
    }
  }
});

test('API gerencia marcas no banco de testes', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');

  const url = new URL(databaseUrl);

  assert.equal(
    decodeURIComponent(url.pathname.slice(1)),
    EXPECTED_DATABASE,
    'Banco de dados nao autorizado',
  );

  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(process.env.JWT_ACCESS_SECRET);

  const { default: db } = await import('../../src/config/db.js');

  const resultado = await db.$queryRaw`
    SELECT current_database() AS banco
  `;

  assert.equal(resultado[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  const identificador = `PI2-MARCA-${Date.now()}`;

  let administrador = null;
  let usuarioComum = null;
  let marca = null;

  try {
    administrador = await db.user.create({
      data: {
        name: 'Administrador Teste Marca',
        username: `admin_marca_${Date.now()}`,
        email: `admin_marca_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    usuarioComum = await db.user.create({
      data: {
        name: 'Usuario Comum Teste Marca',
        username: `comum_marca_${Date.now()}`,
        email: `comum_marca_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    const headersAdmin = {
      authorization: `Bearer ${jwt.sign(
        { id: administrador.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    const headersComum = {
      authorization: `Bearer ${jwt.sign(
        { id: usuarioComum.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/auxiliares/marcas',
      headers: headersAdmin,
      payload: {
        marca: `Marca ${identificador}`,
      },
    });

    assert.equal(cadastro.statusCode, 201, cadastro.body);

    marca = cadastro.json().data;

    assert.ok(marca?.id);
    assert.equal(marca.marca, `Marca ${identificador}`);

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/marcas/${marca.id}`,
      headers: headersAdmin,
    });

    assert.equal(consulta.statusCode, 200, consulta.body);
    assert.equal(consulta.json().data.id, marca.id);

    const novoNome = `Marca Atualizada ${identificador}`;

    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/auxiliares/marcas/${marca.id}`,
      headers: headersAdmin,
      payload: {
        marca: novoNome,
      },
    });

    assert.equal(atualizacao.statusCode, 200, atualizacao.body);

    const registro = await db.marca.findUnique({
      where: { id: marca.id },
    });

    assert.equal(registro.marca, novoNome);

    const pesquisa = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/marcas?search=${encodeURIComponent(identificador)}`,
      headers: headersAdmin,
    });

    assert.equal(pesquisa.statusCode, 200, pesquisa.body);

    assert.ok(
      pesquisa.json().data.some((item) => item.id === marca.id),
      'Marca nao encontrada na pesquisa',
    );

    const exclusaoNegada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/marcas/${marca.id}`,
      headers: headersComum,
    });

    assert.equal(
      exclusaoNegada.statusCode,
      403,
      exclusaoNegada.body,
    );

    assert.ok(
      await db.marca.findUnique({
        where: { id: marca.id },
      }),
      'Marca excluida por usuario sem permissao',
    );

    const exclusaoAutorizada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/marcas/${marca.id}`,
      headers: headersAdmin,
    });

    assert.equal(
      exclusaoAutorizada.statusCode,
      200,
      exclusaoAutorizada.body,
    );

    assert.equal(
      await db.marca.findUnique({
        where: { id: marca.id },
      }),
      null,
    );

    marca = null;

    console.log('CRUD de marcas validado.');
    console.log('Pesquisa e permissoes validadas.');
    console.log('Persistencia no PostgreSQL confirmada.');
  } finally {
    if (marca?.id) {
      await db.marca.deleteMany({
        where: { id: marca.id },
      });
    }

    if (usuarioComum?.id) {
      await db.user.deleteMany({
        where: { id: usuarioComum.id },
      });
    }

    if (administrador?.id) {
      await db.user.deleteMany({
        where: { id: administrador.id },
      });
    }
  }
});

test('API gerencia fornecedores no banco de testes', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, 'DATABASE_URL nao configurada');

  const url = new URL(databaseUrl);

  assert.equal(
    decodeURIComponent(url.pathname.slice(1)),
    EXPECTED_DATABASE,
    'Banco de dados nao autorizado',
  );

  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(process.env.JWT_ACCESS_SECRET);

  const { default: db } = await import('../../src/config/db.js');

  const resultado = await db.$queryRaw`
    SELECT current_database() AS banco
  `;

  assert.equal(resultado[0].banco, EXPECTED_DATABASE);

  const { default: app } = await import('../../src/app.js');

  const identificador = `PI2-FORN-${Date.now()}`;
  const cnpjTeste = String(Date.now()).padStart(14, '0').slice(-14);

  let administrador = null;
  let usuarioComum = null;
  let fornecedor = null;

  try {
    administrador = await db.user.create({
      data: {
        name: 'Administrador Teste Fornecedor',
        username: `admin_forn_${Date.now()}`,
        email: `admin_forn_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'admin',
        status: 'active',
      },
    });

    usuarioComum = await db.user.create({
      data: {
        name: 'Usuario Comum Teste Fornecedor',
        username: `comum_forn_${Date.now()}`,
        email: `comum_forn_${Date.now()}@example.com`,
        password: 'SenhaTemporariaTeste123!',
        role: 'user',
        status: 'active',
      },
    });

    const headersAdmin = {
      authorization: `Bearer ${jwt.sign(
        { id: administrador.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    const headersComum = {
      authorization: `Bearer ${jwt.sign(
        { id: usuarioComum.id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      )}`,
    };

    const cadastro = await app.inject({
      method: 'POST',
      url: '/api/v1/auxiliares/fornecedores',
      headers: headersAdmin,
      payload: {
        razao_social: `Fornecedor ${identificador}`,
        cnpj: cnpjTeste,
        telefone: '18999990000',
        email: 'fornecedor-teste@example.com',
      },
    });

    assert.equal(cadastro.statusCode, 201, cadastro.body);

    fornecedor = cadastro.json().data;

    assert.ok(fornecedor?.id);
    assert.equal(fornecedor.cnpj, cnpjTeste);

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/fornecedores/${fornecedor.id}`,
      headers: headersAdmin,
    });

    assert.equal(consulta.statusCode, 200, consulta.body);
    assert.equal(consulta.json().data.id, fornecedor.id);

    const novoNome = `Fornecedor Atualizado ${identificador}`;

    const atualizacao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/auxiliares/fornecedores/${fornecedor.id}`,
      headers: headersAdmin,
      payload: {
        razao_social: novoNome,
        telefone: '1833334444',
      },
    });

    assert.equal(atualizacao.statusCode, 200, atualizacao.body);

    const registro = await db.fornecedor.findUnique({
      where: { id: fornecedor.id },
    });

    assert.equal(registro.razao_social, novoNome);
    assert.equal(registro.telefone, '1833334444');
    assert.equal(registro.cnpj, cnpjTeste);

    const pesquisa = await app.inject({
      method: 'GET',
      url: `/api/v1/auxiliares/fornecedores?search=${encodeURIComponent(identificador)}`,
      headers: headersAdmin,
    });

    assert.equal(pesquisa.statusCode, 200, pesquisa.body);

    assert.ok(
      pesquisa.json().data.some((item) => item.id === fornecedor.id),
      'Fornecedor nao encontrado na pesquisa',
    );

    const exclusaoNegada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/fornecedores/${fornecedor.id}`,
      headers: headersComum,
    });

    assert.equal(
      exclusaoNegada.statusCode,
      403,
      exclusaoNegada.body,
    );

    assert.ok(
      await db.fornecedor.findUnique({
        where: { id: fornecedor.id },
      }),
      'Fornecedor excluido por usuario sem permissao',
    );

    const exclusaoAutorizada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auxiliares/fornecedores/${fornecedor.id}`,
      headers: headersAdmin,
    });

    assert.equal(
      exclusaoAutorizada.statusCode,
      200,
      exclusaoAutorizada.body,
    );

    assert.equal(
      await db.fornecedor.findUnique({
        where: { id: fornecedor.id },
      }),
      null,
    );

    fornecedor = null;

    console.log('CRUD de fornecedores validado.');
    console.log('CNPJ e persistencia confirmados.');
    console.log('Pesquisa e permissoes validadas.');
  } finally {
    if (fornecedor?.id) {
      await db.fornecedor.deleteMany({
        where: { id: fornecedor.id },
      });
    }

    if (usuarioComum?.id) {
      await db.user.deleteMany({
        where: { id: usuarioComum.id },
      });
    }

    if (administrador?.id) {
      await db.user.deleteMany({
        where: { id: administrador.id },
      });
    }
  }
});

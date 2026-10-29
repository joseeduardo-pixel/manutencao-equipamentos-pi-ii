import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Menu de acessibilidade (botão flutuante acima do VLibras).
// As preferências ficam salvas no navegador (localStorage) e são aplicadas
// como classes no elemento <html>. Os estilos estão em src/acessibilidade.css.

const CHAVE_STORAGE = 'acessibilidade-preferencias';

// Níveis de tamanho do texto (zoom aplicado ao #root)
const NIVEIS_FONTE = [0.9, 1, 1.15, 1.3, 1.5];
const NIVEL_PADRAO = 1;

const PADRAO = {
  fonte: NIVEL_PADRAO,
  contraste: false,
  cinza: false,
  links: false,
  espacamento: false,
  fonteLegivel: false,
  cursor: false,
  foco: false,
  semAnimacao: false,
  leitor: false,
};

// Opções liga/desliga: chave, classe CSS no <html>, texto e ícone
const OPCOES = [
  { chave: 'contraste', classe: 'a11y-contraste', rotulo: 'Alto contraste', icone: 'bi-circle-half' },
  { chave: 'cinza', classe: 'a11y-cinza', rotulo: 'Escala de cinza', icone: 'bi-droplet-half' },
  { chave: 'links', classe: 'a11y-links', rotulo: 'Destacar links', icone: 'bi-link-45deg' },
  { chave: 'espacamento', classe: 'a11y-espacamento', rotulo: 'Espaçar texto', icone: 'bi-text-paragraph' },
  { chave: 'fonteLegivel', classe: 'a11y-fonte-legivel', rotulo: 'Fonte legível', icone: 'bi-fonts' },
  { chave: 'cursor', classe: 'a11y-cursor', rotulo: 'Cursor grande', icone: 'bi-cursor-fill' },
  { chave: 'foco', classe: 'a11y-foco', rotulo: 'Realçar foco', icone: 'bi-bullseye' },
  { chave: 'semAnimacao', classe: 'a11y-sem-animacao', rotulo: 'Pausar animações', icone: 'bi-pause-circle' },
  { chave: 'leitor', classe: 'a11y-leitor', rotulo: 'Ler ao clicar', icone: 'bi-volume-up' },
];

function carregarPreferencias() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_STORAGE));
    return { ...PADRAO, ...salvo };
  } catch {
    return { ...PADRAO };
  }
}

// Leitura em voz alta com a voz do próprio navegador (Web Speech API)
function falar(texto) {
  if (!('speechSynthesis' in window) || !texto) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto.slice(0, 600));
  fala.lang = 'pt-BR';
  const vozPt = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang?.toLowerCase().startsWith('pt'));
  if (vozPt) fala.voice = vozPt;
  window.speechSynthesis.speak(fala);
}

// Descobre o texto que deve ser lido para o elemento clicado
function textoDoElemento(el) {
  const alvo = el.closest(
    'button, a, label, th, td, li, h1, h2, h3, h4, h5, h6, p, input, select, textarea, [aria-label]'
  ) || el;

  if (alvo.matches('input, textarea')) {
    const rotulo = alvo.labels?.[0]?.innerText || alvo.getAttribute('aria-label') || alvo.placeholder || '';
    return rotulo;
  }
  if (alvo.matches('select')) {
    const rotulo = alvo.labels?.[0]?.innerText || alvo.getAttribute('aria-label') || '';
    return `${rotulo}. ${alvo.options[alvo.selectedIndex]?.text || ''}`;
  }
  return (alvo.getAttribute('aria-label') || alvo.innerText || alvo.textContent || '').trim();
}

export default function AcessibilidadeMenu() {
  const [prefs, setPrefs] = useState(carregarPreferencias);
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef(null);
  const painelRef = useRef(null);

  // Aplica as preferências no <html> e salva no navegador
  useEffect(() => {
    const html = document.documentElement;
    OPCOES.forEach(({ chave, classe }) => html.classList.toggle(classe, !!prefs[chave]));
    html.style.setProperty('--a11y-zoom', String(prefs.fonte));
    html.classList.toggle('a11y-zoom', prefs.fonte !== NIVEL_PADRAO);
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(prefs));
  }, [prefs]);

  // "Ler ao clicar": lê em voz alta o texto do elemento clicado
  useEffect(() => {
    if (!prefs.leitor) {
      window.speechSynthesis?.cancel();
      return undefined;
    }
    const aoClicar = (e) => {
      if (painelRef.current?.contains(e.target)) return;
      falar(textoDoElemento(e.target));
    };
    document.addEventListener('click', aoClicar, true);
    return () => document.removeEventListener('click', aoClicar, true);
  }, [prefs.leitor]);

  // Fecha com Esc e ao clicar fora; atalho Alt + A abre/fecha
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape' && aberto) {
        setAberto(false);
        botaoRef.current?.focus();
      }
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    const aoClicarFora = (e) => {
      if (!aberto) return;
      if (painelRef.current?.contains(e.target) || botaoRef.current?.contains(e.target)) return;
      setAberto(false);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('mousedown', aoClicarFora);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, [aberto]);

  // Ao abrir, leva o foco para dentro do painel
  useEffect(() => {
    if (aberto) painelRef.current?.querySelector('button')?.focus();
  }, [aberto]);

  const alternar = (chave) => setPrefs((p) => ({ ...p, [chave]: !p[chave] }));

  const indiceFonte = NIVEIS_FONTE.indexOf(prefs.fonte);
  const mudarFonte = (passo) => {
    const novo = Math.min(NIVEIS_FONTE.length - 1, Math.max(0, indiceFonte + passo));
    setPrefs((p) => ({ ...p, fonte: NIVEIS_FONTE[novo] }));
  };

  const redefinir = () => setPrefs({ ...PADRAO });
  const algoAtivo = JSON.stringify(prefs) !== JSON.stringify(PADRAO);

  return createPortal(
    <div className="a11y-widget">
      <button
        ref={botaoRef}
        type="button"
        className={`a11y-botao ${algoAtivo ? 'a11y-botao-ativo' : ''}`}
        onClick={() => setAberto((v) => !v)}
        aria-label="Abrir menu de acessibilidade (Alt + A)"
        aria-expanded={aberto}
        aria-controls="a11y-painel"
        title="Acessibilidade (Alt + A)"
      >
        <i className="bi bi-universal-access" aria-hidden="true" />
      </button>

      {aberto && (
        <div
          id="a11y-painel"
          ref={painelRef}
          className="a11y-painel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="a11y-titulo"
        >
          <div className="a11y-cabecalho">
            <h2 id="a11y-titulo">
              <i className="bi bi-universal-access" aria-hidden="true" /> Acessibilidade
            </h2>
            <button
              type="button"
              className="a11y-fechar"
              onClick={() => {
                setAberto(false);
                botaoRef.current?.focus();
              }}
              aria-label="Fechar menu de acessibilidade"
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>

          <div className="a11y-secao">
            <span className="a11y-rotulo" id="a11y-fonte-rotulo">Tamanho do texto</span>
            <div className="a11y-fonte" role="group" aria-labelledby="a11y-fonte-rotulo">
              <button
                type="button"
                onClick={() => mudarFonte(-1)}
                disabled={indiceFonte <= 0}
                aria-label="Diminuir texto"
              >
                A-
              </button>
              <span className="a11y-fonte-valor" aria-live="polite">
                {Math.round(prefs.fonte * 100)}%
              </span>
              <button
                type="button"
                onClick={() => mudarFonte(1)}
                disabled={indiceFonte >= NIVEIS_FONTE.length - 1}
                aria-label="Aumentar texto"
              >
                A+
              </button>
            </div>
          </div>

          <div className="a11y-grade">
            {OPCOES.map(({ chave, rotulo, icone }) => (
              <button
                key={chave}
                type="button"
                className={`a11y-opcao ${prefs[chave] ? 'ativo' : ''}`}
                onClick={() => alternar(chave)}
                aria-pressed={!!prefs[chave]}
              >
                <i className={`bi ${icone}`} aria-hidden="true" />
                <span>{rotulo}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="a11y-redefinir"
            onClick={redefinir}
            disabled={!algoAtivo}
          >
            <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Redefinir tudo
          </button>

          <p className="a11y-dica">
            Atalho: <kbd>Alt</kbd> + <kbd>A</kbd>. Para Libras, use o botão azul abaixo.
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}

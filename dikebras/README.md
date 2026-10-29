# Dikebras — modelo de site (proposta)

Proposta de site para a **Dikebras Barbearia | Bar & Sinuca**, feita pela **Scroll House** e publicada na Vercel. Não é o site oficial da barbearia.

Três animações 3D guiadas pelo scroll:
1. **Tesoura e navalha**: a tesoura corta conforme você rola e a navalha abre ao chegar no cardápio.
2. **Sinuca**: o taco recua, bate e as bolas se espalham. A física é simulada uma vez no carregamento e o scroll escolhe o quadro, então dá para voltar a jogada.
3. **Copão**: drink em degradê girando, gelo boiando, bolhas e gotas de condensação escorrendo.

Conteúdo (preços, planos, equipe, endereço) tirado do Instagram @dikebras_.

## Tecnologias
HTML, CSS e JavaScript puro · [Three.js](https://threejs.org/) · [GSAP](https://gsap.com/) · [Lenis](https://lenis.darkroom.engineering/) (rolagem suave)

## Realismo
- **Estúdio de luz virtual** (`js/env.js`): softboxes e faixas em degradê viram o mapa de reflexo do cromado.
- **Peças arredondadas**: contornos 2D extrudados com chanfro e normais suaves; lâminas afinam até o fio.
- **Sinuca**: feltro com textura e relevo, madeira envernizada, luminária com sombra suave, câmera lenta logo após a tacada.
- **Copão**: efeito fresnel (bordas mais opacas e brilhantes) no plástico, gelo e gotas; redemoinho no líquido.

## Estrutura
```
index.html      seções e conteúdo
style.css       visual e responsivo
main.js         cena, câmera e ligação com o scroll
js/tools.js     tesoura e navalha
js/pool.js      mesa, bolas, taco e simulação da tacada
js/drink.js     copão, líquido, gelo e condensação
js/env.js       estúdio de luz para os reflexos
```

## Rodar e publicar
Live Server no `index.html` (ou `npx serve .`). Na Vercel: Framework **Other**, Root Directory **`dikebras`**.

## Agenda online
Páginas sem animação, ligadas a um banco **Supabase** (projeto `dikebras-agenda`, separado de outros projetos):

| Página | O que faz |
|---|---|
| `agendar.html` | Cliente escolhe barbeiro → serviço → dia → horário. Só aparecem horários livres. |
| `conta.html` | Cadastro com foto, login, troca de senha, próximos horários e cancelamento (até 1h antes). |
| `painel.html` | Equipe vê a agenda do dia com foto do cliente, marca concluído/faltou/cancela e bloqueia horários. Atualiza sozinho. |

Regras no banco:
- Terça a sábado, 10h às 19h; último início 18h30 e o serviço precisa terminar até 19h.
- Dois clientes nunca pegam o mesmo horário (restrição no banco, não só na tela).
- Máximo de 3 horários futuros por cliente.
- Fotos privadas: só o próprio cliente e a equipe veem.
- Papéis: `client`, `barber` (vê a própria cadeira) e `owner` (vê todas). Barbeiro vira barbeiro quando se cadastra com o e-mail registrado em `barbers.email`; dono pelo e-mail em `owner_emails`.

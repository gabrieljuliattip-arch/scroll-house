# Dikebras — modelo de site (proposta)

Proposta de site para a **Dikebras Barbearia | Bar & Sinuca**, feita pela **Scroll House**. Não é o site oficial da barbearia.

Três animações 3D guiadas pelo scroll:
1. **Tesoura e navalha**: a tesoura corta conforme você rola e a navalha abre ao chegar no cardápio.
2. **Sinuca**: o taco recua, bate e as bolas se espalham. A física é simulada uma vez no carregamento e o scroll escolhe o quadro, então dá para voltar a jogada.
3. **Copão**: drink em degradê girando, gelo boiando, bolhas e gotas de condensação escorrendo.

Conteúdo (preços, planos, equipe, endereço) tirado do Instagram @dikebras_.

## Tecnologias
HTML, CSS e JavaScript puro · [Three.js](https://threejs.org/) · [GSAP](https://gsap.com/)

## Estrutura
```
index.html      seções e conteúdo
style.css       visual e responsivo
main.js         cena, câmera e ligação com o scroll
js/tools.js     tesoura e navalha
js/pool.js      mesa, bolas, taco e simulação da tacada
js/drink.js     copão, líquido, gelo e condensação
```

## Rodar e publicar
Live Server no `index.html` (ou `npx serve .`). Na Vercel: Framework **Other**, Root Directory **`dikebras`**.

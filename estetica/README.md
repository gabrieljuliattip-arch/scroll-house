# Espelhado — estética automotiva (site conceito)

Marca fictícia de estética automotiva. Projeto de portfólio da **Scroll House**, publicado na Vercel.

## A ideia
O objeto 3D é um *speed shape* — a peça curva que estúdios usam para mostrar pintura.
- **Hero:** metade da peça polida, metade fosca (o teste "50/50" que todo detalhador faz).
- **Polimento:** ao rolar, a politriz roto-orbital passa pela peça e o verniz vira espelho. Um medidor mostra o verniz (µm) e a área polida.
- **Vitrificação:** gotas caem, formam bolinhas (hidrofobia) e escorrem.
- **Reflexo:** o "estúdio" virtual tem o teto de luminárias hexagonais de LED, que aparece refletido na pintura.

## Tecnologias
HTML, CSS e JavaScript puro · Three.js · GSAP · Lenis

## Estrutura
```
index.html      seções e conteúdo
style.css       visual e responsivo
main.js         cena, poses por seção, ligação com o scroll
js/env.js       estúdio com teto hexagonal (mapa de reflexo)
js/shape.js     speed shape + shader da pintura (fosco → espelhado, flocos metálicos)
js/polisher.js  politriz com boina girando
js/water.js     gotas de vitrificação
```

## Rodar e publicar
Live Server no `index.html` (ou `npx serve .`). Na Vercel: Framework **Other**, Root Directory **`estetica`**.

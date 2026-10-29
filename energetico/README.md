# RAIO Energy — site conceito

Landing page de um energético fictício com lata 3D que gira e muda de sabor conforme o scroll.
Projeto de portfólio da **Scroll House**.

## Tecnologias
- HTML, CSS e JavaScript puro (sem build)
- [Three.js](https://threejs.org/) para a lata 3D (rótulo desenhado em canvas)
- [GSAP + ScrollTrigger](https://gsap.com/) para as animações de scroll

## Rodar no computador
Por usar módulos JavaScript, o site precisa de um servidor local (abrir o arquivo direto não funciona):

- **Antigravity / VS Code:** instale a extensão *Live Server*, clique com o botão direito em `index.html` → *Open with Live Server*.
- **Ou pelo terminal:** `npx serve .` dentro desta pasta e abra o endereço mostrado.

## Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: *Add New → Project*, escolha o repositório.
3. Framework Preset: **Other**. Root Directory: `energetico` (se o repositório tiver outras pastas). Deploy.

## Estrutura
```
index.html   conteúdo e seções
style.css    visual e responsivo
main.js      cena 3D, sabores e animações
```

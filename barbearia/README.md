# Navalha Barbearia — site conceito

Landing page de uma barbearia fictícia em Pinheiros (SP). Um poste de barbeiro 3D atravessa a página: as listras sobem sem parar (e aceleram quando você rola), e o poste muda de lado a cada seção até deitar no final, em cima do convite para agendar.
Projeto de portfólio da **Scroll House**.

## Tecnologias
- HTML, CSS e JavaScript puro (sem build)
- [Three.js](https://threejs.org/) para o poste 3D (listras desenhadas em canvas)
- [GSAP + ScrollTrigger](https://gsap.com/) para as animações de scroll

## Rodar no computador
- **Antigravity / VS Code:** extensão *Live Server* → botão direito em `index.html` → *Open with Live Server*.
- **Ou pelo terminal:** `npx serve .` dentro desta pasta.

## Publicar na Vercel
Novo projeto apontando para este repositório, Framework **Other**, Root Directory **`barbearia`**.

## Estrutura
```
index.html   seções: hero, a casa, serviços, equipe, agendar
style.css    visual e responsivo
main.js      cena 3D e animações
```

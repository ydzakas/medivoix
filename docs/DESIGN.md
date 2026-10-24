# Design

Interface en français, mobile d'abord, police Inter servie depuis `public/fonts/`.

## Couleurs

| Rôle | Valeur |
| --- | --- |
| Marine, texte et actions principales | `#0B2A4A` |
| Vert médical, succès et écoute | `#1E9E6A` |
| Blanc, fond | `#FFFFFF` |

Pas de dégradé, de flou, d'ombre portée, d'opacité, de `rgba` ni d'autre code couleur. Les cibles font au moins 44 px.

## Écoute

Le micro qui écoute est vert, avec un contour qui s'épaissit. Le texte reconnu en cours est en marine italique, souligné d'un filet vert. Le rouge et le gris sortent de la charte, donc ils ne sont pas utilisés.

## États

Chaque écran prévoit un état vide, un chargement annoncé (« Chargement… ») et une alerte d'erreur en français. Les messages d'erreur ne citent pas la dictée.

# Worker ISNA — notifs live (process long-running de pollers).
# Contexte de build = apps/worker (déployé via `railway up apps/worker --path-as-root`),
# pour ne PAS hériter du railway.json/Dockerfile.full de l'API à la racine du monorepo.
FROM node:22-alpine
WORKDIR /app

# ffmpeg : requis par le générateur de shorts (découpage + recadrage 9:16 +
# extraction audio pour Whisper + incrustation des sous-titres SRT).
#
# ⚠️ fontconfig + font-noto NE SONT PAS DÉCORATIFS. Le filtre `subtitles` de ffmpeg
# grave le texte via libass, et libass a besoin d'une POLICE : sur `node:22-alpine`
# il n'y en a aucune. L'image promettait donc des « extraits verticaux sous-titrés »
# que le conteneur ne pouvait pas produire — et sans bruit, puisque ffmpeg sort en
# code 0 après avoir dessiné du vide. font-noto couvre le français accentué.
# À contrôler UNE FOIS sur le conteneur déployé (rien de tout cela n'est
# reproductible en local : le ffmpeg Homebrew du poste de dev n'a même pas libass) :
#   ffmpeg -filters | grep subtitles     → le filtre existe-t-il ?
#   fc-list | head                       → une police est-elle visible ?
RUN apk add --no-cache ffmpeg fontconfig font-noto

COPY package.json ./
# --include=dev pour garder tsx (devDependency) requis au runtime.
RUN npm install --include=dev --legacy-peer-deps --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
# Entrypoint allégé : pipeline notifs live uniquement (cf. src/index.live.ts).
CMD ["npx", "tsx", "src/index.live.ts"]

# Open Discord Backend (Core + Server Node)

## Quick start
1) `cp .env.example .env` and fill secrets/JWKs (see note below)
2) `docker compose up -d`
3) `npm install`
4) `npm run migrate:core && npm run migrate:node`
5) Start:
   - Core: `npm run dev:core`
   - Server node: `npm run dev:node`

## Generate RSA JWKs (one-time)
Use node to generate JWK pair:
- `node -e "const {generateKeyPair} = require('jose'); (async()=>{ const {publicKey, privateKey}=await generateKeyPair('RS256'); console.log(JSON.stringify(await require('jose').exportJWK(privateKey))); console.log(JSON.stringify(await require('jose').exportJWK(publicKey))); })()"`

Put them into CORE_MEMBERSHIP_PRIVATE_JWK and CORE_MEMBERSHIP_PUBLIC_JWK, and set kid in both.

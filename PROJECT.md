# PROJECT.md — voting
*Generado por Bootstrap Agent — SDD System*
*Fecha: 2026-06-18*

## Identidad del proyecto
- Nombre: voting
- Repositorio: no definido (brownfield existente)
- Tipo de software: dapp de votos (voting dapp) con features independientes en un solo repo (V1, V2, V3)
- Estado actual: V2 en progreso; faltan despliegue en Devnet y asegurar que lib.rs y test_initialize.rs funcionen correctamente

## Stack técnico
- Lenguaje principal: Rust
- Framework(s): Anchor 1.0.1
- Runtime / entorno: Solana (Devnet)
- Base de datos / almacenamiento: no definido
- Testing stack: LiteSVM (tests en Rust), uso de crates de dev-dependencies indicadas en Cargo.toml
- CI/CD: no definido
- Infraestructura: no definida (deploy objetivo: Solana Devnet)

## Convenciones del equipo
- Estilo de commits: commits manuales al repositorio; se hacen a main tras confirmar el estado correcto del despliegue
- Rama principal: main
- Estrategia de ramas: versiones en branches permanentes por arquitectura (V1, V2, V3). Features en branches por versión.
- Revisor obligatorio en PR: no definido (commits manuales por el propietario)
- Linter / formatter: Prettier (frontend/otros), rust-analyzer configurado; .anchor, .DS_Store, target, node_modules, dist, build, test-ledger listados en ignore
- Cobertura de tests mínima exigida: no definida

## MCPs activos en este proyecto
[Marca con [x] los que el usuario confirmó, deja [ ] los que no]
- [x] GitHub MCP — gestión de PRs, issues, ramas
- [ ] Linear MCP — tickets y sprints
- [ ] Notion MCP — documentación y PRDs
- [ ] Playwright MCP — testing E2E automático
- [ ] Sentry MCP — monitorización de errores en prod
- [ ] Snyk MCP — análisis de seguridad de dependencias
- [ ] Base de datos MCP: no definido

## Memoria persistente del proyecto
Estos son los hechos que TODOS los agentes deben respetar siempre:
- Decisiones de arquitectura inamovibles: ninguna definida
- Restricciones de negocio permanentes: ninguna definida
- Módulos/archivos protegidos (nunca modificar sin aprobación): ninguna definida
- Dependencias prohibidas: ninguna definida
- Patrones obligatorios: ninguno definido
- Regla importante de privacidad/commit: Ningún contenido relacionado con Spec-Driven Development (specs, cambios de OpenSpec) debe subirse a GitHub; GitHub sólo recibirá código y tests. Ningún commit debe indicar que fue realizado por un agente; solo el nombre del propietario del repo puede aparecer como autor/titular.

## Modelos LLM asignados
- Agente planificador (pasos 0, 1, 2, 5): Gemini Flash / Gemini Pro (usuario dispone de Gemini Flash 3.5 y Gemini Pro en free tier) — (recomendado: Gemini Pro para planificación)
- Agente ejecutor (pasos 3, 4): Qwen (Alibaba free tier) / Claude (free tier) — (recomendado: Qwen para velocidad de implementación)

## Resultado final esperado del proyecto
Una dApp de gobernanza on-chain en Solana que sirve como demostración de tres arquitecturas de votación (V1 account-based, V2 token-gated con escrow y peso proporcional, V3 NFT-gated). Cada versión debe ser ejecutable y verificable en su branch, con tests automatizados que garanticen que lib.rs y test_initialize.rs funcionan, y con despliegue funcional en Devnet para V2.

## Non-Goals del proyecto (fuera de alcance permanente)
no definidos todavía — se irán añadiendo por feature
-
-

---

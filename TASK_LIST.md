# Checklist de Tareas: Nivel 3 (Arquitectura Escalable - Merkle Trees)

Este documento guía el desarrollo iterativo del Nivel 3. 

## Reglas de oro (Ponytail)
- Tareas de máx 30 minutos.
- Si una tarea se desborda, páusala y divídela.
- Mantener compatibilidad con la base de Anchor.

## Roadmap de Implementación

### Tarea 1: Scaffold de Estructura de Datos (Nivel 3)
- [ ] Modificar `PollAccount` para incluir `merkle_root: [u8; 32]` y `nullifier_bitmask: Vec<u8>`.
- [ ] Eliminar `VoteRecord` de las instrucciones de `vote`.

### Tarea 2: Integración de Verificación de Merkle
- [ ] Añadir `solana-merkle-tree` o lógica custom de verificación a `lib.rs`.
- [ ] Implementar función `verify_vote_proof`.

### Tarea 3: Instrucción de Voto (Escalable)
- [ ] Reescribir `vote` para aceptar `proof: Vec<[u8; 32]>` y `leaf_index: u64`.
- [ ] Implementar la lógica del `nullifier_bitmask`.

### Tarea 4: Eventos y Testing
- [ ] Definir `emit!` para los votos.
- [ ] Crear test unitario en LiteSVM para verificar la prueba de Merkle.

## Seguimiento
- Estado actual: Pendiente.
- Notas de sesión: Ninguna aún.

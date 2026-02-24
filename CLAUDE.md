# Binky — Claude Instructions

## Project Overview

This project uses TypeScript (Tauri frontend) and Rust (Tauri backend). Do not suggest or attempt Python/FastAPI approaches. The app is a desktop Tauri app, not a web app.

## Workflow Rules

When executing phase plans, always verify prerequisites (planning, context files) exist before attempting execution. Never re-run discuss or plan phases that are already completed.

## GSD Workflow Rules

After executing wave-based plans, always run a verification pass checking must-have completion percentage before reporting success. Do not mark phases complete with gaps.

## Debugging Guidelines

When debugging, limit yourself to 3 hypotheses before stopping to reassess with the user. List your top hypotheses ranked by likelihood before diving in.

## Error Handling

When hitting rate limits or usage limits mid-workflow, save current progress state to a tracking file before stopping so the workflow can resume cleanly.

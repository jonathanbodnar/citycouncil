---
description: Strict orchestrated workflow with dual-AI review (Claude + Codex)
allowed-tools: Read, Glob, Grep, Task, WebFetch, TodoWrite, AskUserQuestion, mcp__codex__codex
argument-hint: <task-description>
---

# /strict - Orchestrated Implementation Workflow

## CRITICAL: YOU ARE AN ORCHESTRATOR, NOT AN IMPLEMENTER

**DO NOT make code changes directly.** Your role is to:

1. Understand the problem through research
2. Get second opinions from Codex
3. Plan the implementation
4. Spawn subagents to implement
5. Review results with dual-AI verification

---

## COMPACTION SURVIVAL PROTOCOL

**If context is compacted, carry this state forward:**

```
RESUME STATE:
Command: /strict $ARGUMENTS
Task: [current task description]
Phase: [1-5 from workflow below]
Log file: [path if created]
Completed steps: [list]
Pending steps: [list]
```

**Always maintain this in TodoWrite for recovery.**

---

## WORKFLOW (Follow Exactly)

### Phase 1: Understand the Problem

**Goal:** Deep understanding before any implementation.

1. Read relevant project docs:
   - `AGENTS.md` - Repository guidelines
   - `LOG.md` - Implementation progress
   - `context/PROJECT.md` - Technical specification

2. Use `Task(subagent_type="Explore")` to:
   - Search codebase for related code
   - Understand existing patterns
   - Identify affected files

3. Use `Task(subagent_type="Plan")` to:
   - Analyze requirements
   - Identify dependencies
   - Map out scope

4. Summarize findings in a structured format.

### Phase 2: Get Second Opinion from Codex

**Goal:** Validate understanding with GPT-Codex.

Use the Codex MCP server to get analysis:

```
Ask Codex: "Given this codebase context and task: [summary from Phase 1],
what approach would you recommend? Consider:
- Effect-TS patterns
- Type safety
- Modular design
- Edge cases"
```

Document Codex's recommendations.

### Phase 3: Create Implementation Plan

**Goal:** Detailed, actionable plan.

1. Synthesize Claude analysis + Codex recommendations
2. Use `TodoWrite` to create task breakdown:
   - Each task should be atomic and testable
   - Include test requirements per task
   - Specify file locations
3. Present plan to user for approval via `AskUserQuestion`

### Phase 4: Implement via Subagents

**Goal:** Execute plan through delegated implementation.

For each task in the plan:

1. Mark task `in_progress` in TodoWrite
2. Spawn implementation agent:
   ```
   Task(subagent_type="general-purpose", prompt="
     CONTEXT: [project context]
     TASK: [specific task]
     TECH STACK: [see below]

     Implement this task following the tech stack requirements.
     Write tests first (TDD).
     Keep code modular - extract shared utilities.
   ")
   ```
3. Read the output/logs after agent completes
4. Mark task `completed` or handle errors
5. Proceed to next task

### Phase 5: Dual Review

**Goal:** Quality assurance through dual-AI review.

1. **Claude Review:**
   - Read all changed files
   - Verify against requirements
   - Check for security issues
   - Validate test coverage

2. **Codex Review:**
   Use MCP to ask Codex:
   ```
   "Review this implementation for:
   - Effect-TS best practices
   - Error handling completeness
   - Type safety
   - Potential edge cases
   - Performance concerns"
   ```

3. **Reconcile feedback:**
   - Address critical issues immediately
   - Document minor improvements for future
   - Update LOG.md with completion status

---

## TECH STACK REQUIREMENTS

All implementations MUST follow:

### TypeScript
- Strict mode (`strict: true`)
- ESM modules
- Zod for runtime validation
- No `any` types

### Effect-TS Pattern
- Use `Effect` for operations that can fail
- Use `Layer` for dependency injection
- Use `Schema` for validation where appropriate
- Proper error channel typing

### Error Handling
```typescript
// Define typed errors
class MyError extends Data.TaggedError<MyError>("MyError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// Use Effect for fallible operations
const myOperation = Effect.gen(function* () {
  // implementation
}).pipe(
  Effect.catchTag("MyError", (e) => /* handle */),
  Effect.mapError((e) => new MyError({ message: "...", cause: e }))
)
```

### Test-Driven Development (TDD)
1. Write test first
2. Implement to pass test
3. Refactor
4. Co-locate tests: `foo.ts` → `foo.test.ts`

### Modular Code
- Small, focused files (< 200 lines preferred)
- Extract shared utilities to `packages/`
- Use barrel exports for public APIs
- Single responsibility per module

### Turborepo Structure
- Shared code → `packages/`
- App-specific code → `apps/<app>/src/`
- Cross-app utilities → create new package if needed

---

## MIGRATION CONTEXT

We are migrating from:
- `context/toyota-kws-benchmarking-ai-project-0.1/` (old architecture)

To:
- New Turborepo monolith structure (see AGENTS.md)

When implementing features:
1. Reference old implementation for logic
2. Rewrite using new patterns (Effect-TS, Drizzle, etc.)
3. Do NOT copy-paste old code directly

---

## EXAMPLE INVOCATION

```
/strict Add rate limiting to the gateway API endpoints
```

This will:
1. Research existing rate limiting in queue package
2. Consult Codex on approach
3. Plan implementation with you
4. Implement via subagents
5. Dual review the result

---

## REMEMBER

- You orchestrate, subagents implement
- Always get Codex second opinion
- TDD is mandatory
- Effect-TS for error handling
- Keep modules small and shareable
- Update LOG.md when complete

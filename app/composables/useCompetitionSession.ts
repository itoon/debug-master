import { computed, shallowRef } from 'vue'
import type { CompetitionSessionStore } from '../storage/contracts'
import type { CompetitionSession, NewCompetitionSession, SessionOperation, SessionReceipt } from '../types/competition'
import { applySessionOperation, createCompetitionSession } from '../utils/competition/session'

type Action = SessionOperation extends infer O ? O extends SessionOperation ? Omit<O, 'id' | 'at' | 'expectedRevision'> : never : never
export type CompetitionOperationInput = Action & { at?: number; id?: string; complete?: boolean }
type Job = { operation: SessionOperation; resolve: (receipt: SessionReceipt | undefined) => void }

/** Captures transitions synchronously; commits their immutable operations in order. */
export function useCompetitionSession(repository: CompetitionSessionStore) {
  const session = shallowRef<CompetitionSession>()
  const pendingOperation = shallowRef<SessionOperation>()
  const saveError = shallowRef<unknown>()
  const creating = shallowRef<CompetitionSession>()
  const writing = shallowRef(false)
  const busy = computed(() => writing.value || !!pendingOperation.value || !!creating.value || !!saveError.value)
  let queue: Job[] = []
  let generation = 0
  let draining: Promise<void> | undefined
  let createResolve: ((saved: CompetitionSession | undefined) => void) | undefined
  let sequence = 0
  const uid = () => globalThis.crypto?.randomUUID?.() ?? `operation-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`

  function abandon() {
    generation++
    for (const job of queue) job.resolve(undefined)
    queue = []
    createResolve?.(undefined)
    createResolve = undefined
    pendingOperation.value = undefined
    creating.value = undefined
    writing.value = false
    saveError.value = undefined
    session.value = undefined
    draining = undefined
  }

  function drain(): Promise<void> {
    if (draining) return draining
    const token = generation
    writing.value = true
    draining = Promise.resolve().then(async () => {
      try {
        if (creating.value) {
          const initial = creating.value
          // Creation retry also handles an acknowledgement lost after persistence.
          const existing = repository.get(initial.id)
          if (!existing) await repository.create(initial)
          if (token !== generation) return
          session.value = existing ?? initial
          creating.value = undefined
          createResolve?.(session.value)
          createResolve = undefined
        }
        while (queue.length && token === generation) {
          const job = queue[0]!
          pendingOperation.value = job.operation
          const receipt = await repository.apply(session.value!.id, job.operation)
          if (token !== generation) return
          queue.shift()
          if (!queue.length) session.value = receipt.session
          job.resolve(receipt)
        }
        if (token === generation) {
          pendingOperation.value = undefined
          saveError.value = undefined
        }
      } catch (error) {
        if (token !== generation) return
        if (error instanceof Error && /stale session revision/i.test(error.message)) {
          // Never replay board evidence against a different tab's checkpoint.
          const canonical = repository.get(session.value!.id)
          for (const job of queue) job.resolve(undefined)
          queue = []
          session.value = canonical
          pendingOperation.value = undefined
          saveError.value = undefined
        } else saveError.value = error
      } finally {
        if (token === generation) { writing.value = false; draining = undefined }
      }
    })
    return draining
  }

  async function start(input: NewCompetitionSession): Promise<CompetitionSession | undefined> {
    abandon()
    const initial = createCompetitionSession(input)
    session.value = initial
    creating.value = initial
    const saved = new Promise<CompetitionSession | undefined>(resolve => { createResolve = resolve })
    void drain()
    return saved
  }

  async function resume(id: string): Promise<CompetitionSession | undefined> {
    abandon()
    session.value = repository.get(id)
    if (!session.value) throw new Error('Competition session not found')
    if (session.value.status === 'active' && session.value.deadline !== undefined && Date.now() >= session.value.deadline) await finish(Date.now())
    return session.value
  }

  function enqueue(input: CompetitionOperationInput): Promise<SessionReceipt | undefined> {
    const current = session.value!
    const { complete: _complete, ...action } = input
    const operation = { ...action, id: input.id ?? uid(), at: input.at ?? Date.now(), expectedRevision: current.revision } as SessionOperation
    const transition = applySessionOperation(current, operation)
    session.value = transition.session
    const saved = new Promise<SessionReceipt | undefined>(resolve => queue.push({ operation, resolve }))
    pendingOperation.value ??= operation
    return saved
  }

  function apply(input: CompetitionOperationInput): Promise<SessionReceipt | undefined> {
    if (!session.value || session.value.status === 'finished' || busy.value) return Promise.resolve(undefined)
    try {
      const canonical = repository.get(session.value.id)
      if (canonical && canonical.revision !== session.value.revision) {
        session.value = canonical
        return Promise.resolve(undefined)
      }
    } catch { /* The queued repository write reports storage failures with a retryable operation. */ }
    const at = input.at ?? Date.now()
    if (session.value.deadline !== undefined && at > session.value.deadline) return finish(at)
    let saved = enqueue({ ...input, at })
    if (input.type === 'correct-input' && input.complete) saved = enqueue({ type: 'complete-level', at })
    void drain()
    return saved
  }

  function finish(at: number): Promise<SessionReceipt | undefined> {
    if (!session.value || session.value.status === 'finished') return Promise.resolve(undefined)
    const saved = enqueue({ type: 'finish', at: Math.max(at, session.value.updatedAt) })
    if (!saveError.value) void drain()
    return saved
  }

  async function retry(): Promise<void> {
    if (writing.value) return draining
    saveError.value = undefined
    await drain()
  }
  return { session, pendingOperation, saveError, busy, start, resume, apply, retry, finish, abandon }
}

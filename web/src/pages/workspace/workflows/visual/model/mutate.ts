// Edits to the workflow YAML Document. Each function changes only the nodes
// it touches, so comments, key order and formatting elsewhere survive.
import { Document, isMap, isScalar, isSeq, Pair, Scalar, visit, YAMLMap, YAMLSeq } from "yaml"
import { normalizeNeeds, normalizeOn } from "./parse"

export const STRINGIFY_OPTS = { lineWidth: 0, nullStr: "" } as const

type Value = unknown
const isEmpty = (v: Value) => v === undefined || v === null || v === ""

/**
 * An emptied collection is written as `[]` / `{}` and parses back as flow
 * style, so items added to it later come out inline (`[ { uses: … } ]`).
 * Turn empty flow collections back to block style before adding to them.
 */
function blockIfEmpty<T extends YAMLMap | YAMLSeq>(coll: T): T {
    if (coll.flow && coll.items.length === 0) coll.flow = false
    return coll
}

function ensureRootMap(doc: Document): YAMLMap {
    if (!isMap(doc.contents)) doc.contents = doc.createNode({}) as YAMLMap
    return doc.contents as YAMLMap
}

function ensureJobsMap(doc: Document): YAMLMap {
    const root = ensureRootMap(doc)
    const jobs: unknown = root.get("jobs", true)
    if (isMap(jobs)) return blockIfEmpty(jobs)
    const created = doc.createNode({}) as YAMLMap
    root.set("jobs", created)
    return created
}

function jobMap(doc: Document, id: string): YAMLMap {
    const job = ensureJobsMap(doc).get(id, true)
    if (!isMap(job)) throw new Error(`job "${id}" not found`)
    return job
}

function stepsSeq(doc: Document, jobId: string): YAMLSeq {
    const job = jobMap(doc, jobId)
    const steps: unknown = job.get("steps", true)
    // Steps are always block style; inline steps are unreadable.
    if (isSeq(steps)) {
        steps.flow = false
        return steps
    }
    const created = new YAMLSeq()
    job.set("steps", created)
    return created
}

/** Creates a node for value; multi-line strings become `|` block literals. */
function node(doc: Document, value: Value) {
    if (typeof value === "string" && value.includes("\n")) {
        const s = new Scalar(value.endsWith("\n") ? value : value + "\n")
        s.type = Scalar.BLOCK_LITERAL
        return s
    }
    return doc.createNode(value)
}

function setOrDelete(doc: Document, map: YAMLMap, key: string, value: Value) {
    if (isEmpty(value)) map.delete(key)
    else map.set(key, node(doc, value))
}

export function jobIds(doc: Document): string[] {
    return ensureJobsMap(doc).items.map(p => String(isScalar(p.key) ? p.key.value : p.key))
}

export function uniqueJobId(doc: Document, base = "job"): string {
    const ids = new Set(jobIds(doc))
    if (!ids.has(base)) return base
    for (let i = 2; ; i++) if (!ids.has(`${base}-${i}`)) return `${base}-${i}`
}

/** Sets a top-level key such as name or concurrency; empty values delete it. */
export function setRootField(doc: Document, key: string, value: Value) {
    setOrDelete(doc, ensureRootMap(doc), key, value)
}

export function addJob(doc: Document, id: string, needs: string[] = []) {
    const job: Record<string, Value> = {}
    if (needs.length) job.needs = needs.length === 1 ? needs[0] : needs
    job["runs-on"] = "ubuntu-latest"
    job.steps = [{ run: 'echo "Hello"' }]
    const n = doc.createNode(job) as YAMLMap
    const needsNode = n.get("needs", true)
    if (isSeq(needsNode)) needsNode.flow = true
    const jobs = ensureJobsMap(doc)
    const key = doc.createNode(id) as Scalar
    // Keep a blank line between jobs, as hand-written workflows usually do.
    key.spaceBefore = jobs.items.length > 0 && !jobs.flow
    jobs.items.push(new Pair(key, n))
}

export function duplicateJob(doc: Document, id: string): string {
    const jobs = ensureJobsMap(doc)
    const newId = uniqueJobId(doc, `${id}-copy`)
    const idx = jobs.items.findIndex(p => isScalar(p.key) && p.key.value === id)
    if (idx < 0) throw new Error(`job "${id}" not found`)
    const copy = (jobs.items[idx].value as YAMLMap).clone()
    jobs.items.splice(idx + 1, 0, new Pair(doc.createNode(newId), copy))
    return newId
}

export function removeJob(doc: Document, id: string) {
    ensureJobsMap(doc).delete(id)
    for (const other of jobIds(doc)) {
        const needs = getNeeds(doc, other)
        if (needs.includes(id)) setNeeds(doc, other, needs.filter(n => n !== id))
    }
}

export function renameJob(doc: Document, oldId: string, newId: string) {
    if (oldId === newId) return
    const jobs = ensureJobsMap(doc)
    if (jobs.has(newId)) throw new Error(`job "${newId}" already exists`)
    const pair = jobs.items.find(p => isScalar(p.key) && p.key.value === oldId)
    if (!pair) throw new Error(`job "${oldId}" not found`)
    pair.key = doc.createNode(newId)
    for (const other of jobIds(doc)) {
        const needs = getNeeds(doc, other)
        if (needs.includes(oldId)) setNeeds(doc, other, needs.map(n => (n === oldId ? newId : n)))
    }
}

export function getNeeds(doc: Document, id: string): string[] {
    const job = ensureJobsMap(doc).get(id, true)
    if (!isMap(job)) return []
    const n = job.get("needs", true)
    return normalizeNeeds(n === undefined ? undefined : (n as Scalar | YAMLSeq).toJSON())
}

export function setNeeds(doc: Document, id: string, needs: string[]) {
    const job = jobMap(doc, id)
    const unique = [...new Set(needs)]
    if (unique.length === 0) {
        job.delete("needs")
        return
    }
    const value = unique.length === 1 ? doc.createNode(unique[0]) : doc.createNode(unique)
    if (isSeq(value)) value.flow = true
    if (job.has("needs")) job.set("needs", value)
    else job.items.unshift(new Pair(doc.createNode("needs"), value))
}

export function addNeed(doc: Document, id: string, need: string) {
    setNeeds(doc, id, [...getNeeds(doc, id), need])
}

export function removeNeed(doc: Document, id: string, need: string) {
    setNeeds(doc, id, getNeeds(doc, id).filter(n => n !== need))
}

/** Sets one job field (runs-on, name, if, strategy, env…); empty deletes it. */
export function setJobField(doc: Document, id: string, key: string, value: Value) {
    setOrDelete(doc, jobMap(doc, id), key, value)
}

export function addStep(doc: Document, jobId: string, step: Record<string, Value>, at?: number) {
    const seq = stepsSeq(doc, jobId)
    const n = doc.createNode(step)
    if (at === undefined || at >= seq.items.length) seq.items.push(n)
    else seq.items.splice(at, 0, n)
}

export function updateStep(doc: Document, jobId: string, index: number, patch: Record<string, Value>) {
    const seq = stepsSeq(doc, jobId)
    let step = seq.items[index]
    if (step === undefined) throw new Error(`step ${index + 1} does not exist`)
    if (!isMap(step)) {
        step = doc.createNode({}) as YAMLMap
        seq.items[index] = step
    }
    for (const [k, v] of Object.entries(patch)) setOrDelete(doc, blockIfEmpty(step as YAMLMap), k, v)
}

/**
 * Sets or deletes keys of a nested mapping (e.g. a step's `with`) one by
 * one, keeping other keys and comments. Removes the mapping once empty.
 */
export function setMapKeys(doc: Document, path: (string | number)[], patch: Record<string, Value>) {
    let map: unknown = doc.getIn(path, true)
    if (!isMap(map)) {
        if (Object.values(patch).every(isEmpty)) return
        map = doc.createNode({})
        doc.setIn(path, map)
    }
    const m = blockIfEmpty(map as YAMLMap)
    for (const [k, v] of Object.entries(patch)) setOrDelete(doc, m, k, v)
    if (m.items.length === 0) doc.deleteIn(path)
}

export const stepWithPath = (jobId: string, index: number) => ["jobs", jobId, "steps", index, "with"]

/**
 * Turns form text into a YAML value: true/false and integers keep their
 * type, everything else stays a string (so 3.10 doesn't become 3.1).
 */
export function inputValue(text: string): Value {
    if (text === "") return undefined
    if (text === "true" || text === "false") return text === "true"
    if (/^(0|[1-9]\d{0,14})$/.test(text)) return Number(text)
    return text
}

export function removeStep(doc: Document, jobId: string, index: number) {
    stepsSeq(doc, jobId).items.splice(index, 1)
}

export function moveStep(doc: Document, jobId: string, from: number, to: number) {
    const items = stepsSeq(doc, jobId).items
    if (to < 0 || to >= items.length) return
    const [it] = items.splice(from, 1)
    items.splice(to, 0, it)
}

function ensureOnMap(doc: Document): YAMLMap {
    const root = ensureRootMap(doc)
    const on = root.get("on", true)
    if (isMap(on)) return blockIfEmpty(on)
    const normalized = normalizeOn(on === undefined ? undefined : (on as Scalar | YAMLSeq).toJSON())
    const map = doc.createNode(normalized) as YAMLMap
    if (root.has("on")) root.set("on", map)
    else {
        const idx = root.items.findIndex(p => isScalar(p.key) && p.key.value === "name")
        root.items.splice(idx + 1, 0, new Pair(doc.createNode("on"), map))
    }
    return map
}

/** Sets a trigger; undefined removes the event, null keeps it without config. */
export function setTrigger(doc: Document, event: string, value: Value | undefined) {
    const on = ensureOnMap(doc)
    if (value === undefined) {
        on.delete(event)
        return
    }
    const n = value === null ? null : doc.createNode(value)
    // Cron expressions contain `*`; quote them like the docs do.
    if (n)
        visit(n, {
            Pair(_, p) {
                if (isScalar(p.key) && p.key.value === "cron" && isScalar(p.value)) p.value.type = Scalar.QUOTE_SINGLE
            },
        })
    on.set(event, n)
}

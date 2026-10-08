/**
 * Whose data this request is working on.
 *
 * Normally there is one club and one database, and nothing here is set. In
 * sandbox mode every visitor has a database of their own, and the request runs
 * inside `scope.run({ db, outbox, box }, …)`: the data layer and the draft
 * outbox look here first, so not one query in the app needs to know which
 * visitor it is serving — and none can reach another visitor's data by mistake.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export const scope = new AsyncLocalStorage()
export const scoped = () => scope.getStore() || null

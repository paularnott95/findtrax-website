import { canListAsActive, toPublicCase } from './missing-alerts-public-case-mapper.mjs'

export function isBoostActive(caseRecord, now = new Date()) {
  if (!caseRecord.boost?.active) return false
  if (!caseRecord.boost?.expiresAt) return true
  return new Date(caseRecord.boost.expiresAt).getTime() > now.getTime()
}

export function getBoostedCases(cases, now = new Date()) {
  return cases
    .filter((caseRecord) => canListAsActive(caseRecord))
    .filter((caseRecord) => isBoostActive(caseRecord, now))
    .sort((a, b) => Number(b.boost?.points || 0) - Number(a.boost?.points || 0))
    .map((caseRecord) => toPublicCase(caseRecord))
}

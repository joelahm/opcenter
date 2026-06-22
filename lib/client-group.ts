export function clientGroupName(name: string) {
  const trimmedName = name.trim()
  const locationSeparator = trimmedName.lastIndexOf(' - ')
  const withoutLocation = locationSeparator > 0
    ? trimmedName.slice(0, locationSeparator).trim()
    : trimmedName

  return withoutLocation.replace(/^(mr|mrs|ms|miss|dr|doctor|prof|professor)\.?\s+/i, '').trim()
}

export function clientGroupKey(name: string) {
  return clientGroupName(name).toLocaleLowerCase()
}

export function sharedClientGroupName(name: string, knownNames: string[]) {
  const ownName = clientGroupName(name)
  const ownKey = clientGroupKey(name)
  const candidates = knownNames
    .map(candidate => {
      const normalizedName = clientGroupName(candidate)
      return {
        name: normalizedName,
        key: clientGroupKey(candidate),
        exact: candidate.trim() === normalizedName,
      }
    })
    .filter(candidate => {
      if (candidate.key.split(/\s+/).length < 2) return false
      return ownKey === candidate.key
        || ownKey.startsWith(`${candidate.key} `)
        || ownKey.endsWith(` ${candidate.key}`)
        || ownKey.includes(` ${candidate.key} `)
    })
    .sort((a, b) =>
      a.key.length - b.key.length
      || Number(b.exact) - Number(a.exact)
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )

  return candidates[0]?.name || ownName
}

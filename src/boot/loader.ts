/**
 * Profile / bundle composition.
 *
 * DSH equivalent: `packages/boot/app-boot` plus the `dsh.profile` / `dsh.bundle`
 * fields in each `package.json`. The model is worth copying exactly:
 *
 *   profile = ordered bundles + patches
 *   bundle  = an ordered list of rows (id -> plugin -> config)
 *   patch   = "replace this row's config" or "insert this row"
 *
 * Layers apply to an empty row list, so a later layer wins without anyone
 * editing the earlier one. That is how DSH lets a user override one plugin's
 * config in `cordis.patch.yml` while the shipped bundle stays untouched.
 *
 * @module designbuddy/boot/loader
 */

export interface PluginRow {
  /** Stable identity, used by patches and by the boot tree dump. */
  id: string
  /** Key into the module registry, e.g. 'core-tools'. */
  plugin: string
  config?: unknown
  enabled?: boolean
}

export interface Bundle {
  name: string
  rows: PluginRow[]
}

export interface Profile {
  name: string
  bundles: Bundle[]
}

export interface Patch {
  id: string
  /** Present means "insert this row if the id does not exist yet". */
  plugin?: string
  config?: unknown
  enabled?: boolean
}

/** Flatten a profile to its row list, dropping disabled rows. */
export function flatten(profile: Profile): PluginRow[] {
  return profile.bundles.flatMap((bundle) => bundle.rows).filter((row) => row.enabled !== false)
}

/**
 * Apply patches in order. A patch replaces the whole config rather than merging:
 * merging is what makes layered configuration impossible to reason about.
 */
export function applyPatches(rows: PluginRow[], patches: Patch[]): PluginRow[] {
  const result = rows.map((row) => ({ ...row }))
  for (const patch of patches) {
    const index = result.findIndex((row) => row.id === patch.id)
    if (index >= 0) {
      const current = result[index]!
      result[index] = {
        ...current,
        config: 'config' in patch ? patch.config : current.config,
        enabled: patch.enabled ?? current.enabled,
      }
      continue
    }
    if (!patch.plugin) {
      throw new Error(`patch "${patch.id}" targets an unknown row and does not declare a plugin to insert`)
    }
    result.push({ id: patch.id, plugin: patch.plugin, config: patch.config, enabled: patch.enabled })
  }
  return result.filter((row) => row.enabled !== false)
}

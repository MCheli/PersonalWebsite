/**
 * Turn one typed line into output. Pure: everything with a side effect goes
 * through the context (open, clear), so this runs the same in tests, in SSR
 * and in the browser.
 */
import type { CommandContext, OutputBlock } from '~/types/terminal'
import { a, error, kv, muted, success } from './blocks'
import { resolveOpenTarget } from './open'
import { findCommand, suggest } from './registry'

export const parseInput = (input: string): { name: string, args: string[] } | undefined => {
  const words = input.trim().split(/\s+/).filter(w => w.length > 0)
  const name = words[0]
  if (name === undefined) return undefined
  return { name: name.toLowerCase(), args: words.slice(1) }
}

export const execute = async (input: string, ctx: CommandContext): Promise<OutputBlock[]> => {
  const parsed = parseInput(input)
  if (parsed === undefined) return []

  const command = findCommand(parsed.name)
  if (command) return command.run(parsed.args, ctx)

  // A bare project slug, service name or shortcut opens it, as it always has.
  const target = resolveOpenTarget(ctx.content, parsed.name)
  if (target) {
    ctx.open(target.url)
    return [success(`Opening ${target.label}`), kv([{ key: target.name, value: [a(target.url)] }])]
  }

  const blocks = [error(`command not found: ${parsed.name}`)]
  const closest = suggest(parsed.name)
  if (closest !== undefined) blocks.push(muted(`did you mean '${closest}'?`))
  else blocks.push(muted("Type 'help' to see the commands."))
  return blocks
}

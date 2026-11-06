import type { Command } from '~/types/terminal'
import { blank, error, kv, muted, text } from './blocks'
// Circular on purpose: help lists the registry and the registry lists help.
// Both references are only read inside run(), after every module has loaded.
import { commands, findCommand } from './registry'

export const help: Command = {
  name: 'help',
  aliases: ['?'],
  description: 'List commands; help <cmd> for details',
  usage: 'help [command]',
  deepLink: true,
  tour: true,
  run: (args) => {
    const name = args[0]
    if (name !== undefined) {
      const cmd = findCommand(name)
      if (cmd === undefined) return [error(`help: no command called "${name}"`), muted("Type 'help' to list them.")]
      const rows = [{ key: 'usage', value: [cmd.usage ?? cmd.name] }]
      if (cmd.aliases && cmd.aliases.length > 0) rows.push({ key: 'aliases', value: [cmd.aliases.join(', ')] })
      return [text(`${cmd.name} — ${cmd.description}`), kv(rows), text(cmd.longDescription ?? cmd.description, 'muted')]
    }
    return [
      text('Commands', 'info'),
      kv(commands.map(c => ({
        key: c.aliases && c.aliases.length > 0 ? `${c.name}, ${c.aliases.join(', ')}` : c.name,
        value: [c.description]
      }))),
      blank(),
      muted("Typing a project slug or a service name opens it (try 'tallied' or 'plex'). " +
        "Tab completes, Up/Down recall, Ctrl+L clears. 'help <cmd>' for details.")
    ]
  }
}

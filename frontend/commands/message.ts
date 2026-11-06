/**
 * `message`: send Mark a note from the terminal. Three questions on the
 * input line, local validation, then a POST to the API's /contact endpoint.
 * "Sent" is printed only on a 2xx; anything else says so and offers email.
 */
import { PromptCancelled, type Command, type CommandContext, type OutputBlock } from '~/types/terminal'
import { a, error, kv, muted, success, text } from './blocks'

export const MIN_MESSAGE_LENGTH = 10

/** Returns the problem with an answer, or undefined when it is fine. */
export const validateName = (value: string): string | undefined =>
  value.trim().length === 0 ? 'Please enter your name.' : undefined

export const validateEmail = (value: string): string | undefined => {
  const v = value.trim()
  const at = v.indexOf('@')
  if (at < 1 || !v.slice(at + 1).includes('.') || /\s/.test(v)) return 'That does not look like an email address (name@example.com).'
  return undefined
}

export const validateMessage = (value: string): string | undefined =>
  value.trim().length < MIN_MESSAGE_LENGTH ? `A little more, please (at least ${MIN_MESSAGE_LENGTH} characters).` : undefined

/** Ask until the answer passes validation; the cancel rejection propagates. */
const ask = async (ctx: CommandContext, label: string, validate: (v: string) => string | undefined): Promise<string> => {
  for (;;) {
    const answer = await ctx.prompt(label)
    const problem = validate(answer)
    if (problem === undefined) return answer.trim()
    ctx.print([muted(problem)])
  }
}

export const message: Command = {
  name: 'message',
  description: 'Send me a note from here',
  longDescription:
    'Asks for your name, email and message one at a time, then sends them to me through the site API. ' +
    'Ctrl+C cancels at any point. Nothing is sent until all three are answered.',
  run: async (_args, ctx): Promise<OutputBlock[]> => {
    const email = ctx.content.resume.basics.email
    ctx.print([text('Send me a note. Ctrl+C to cancel.')])
    try {
      const name = await ask(ctx, 'Your name:', validateName)
      const from = await ask(ctx, 'Your email:', validateEmail)
      const body = await ask(ctx, 'Message:', validateMessage)
      const result = await ctx.sendMessage({ name, email: from, message: body, website: '' })
      if (result.ok) return [success(`Sent — I'll reply to ${from}.`)]
      const why = result.error ?? `Couldn't send (${result.status ?? 'no response'}).`
      return [error(why), kv([{ key: 'Email me instead', value: [a(`mailto:${email}`, email)] }])]
    } catch (err) {
      if (err instanceof PromptCancelled) return [muted('Cancelled.')]
      throw err
    }
  }
}

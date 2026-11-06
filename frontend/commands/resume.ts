import type { Command } from '~/types/terminal'
import type { Inline } from '~/types/terminal'
import { currentWork, dateRange, locationLine, previousWork } from '~/utils/content'
import { a, blank, heading, kv, list, muted, text } from './blocks'
import { RESUME_PDF_PATH } from './open'

export const resume: Command = {
  name: 'resume',
  description: 'Career summary: roles, education, skills',
  longDescription:
    'Headline, current role with highlights, previous roles one line each, education and skills by group, ' +
    'all from the same resume.json that /resume and the PDF are built from.',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => {
    const r = content.resume
    const current = currentWork(r)
    const blocks = [
      heading(r.basics.name),
      text(r.basics.label),
      text(`${locationLine(r)} · ${r.basics.email}`, 'muted'),
      blank(),
      text(r.basics.summary),
      blank()
    ]

    if (current) {
      blocks.push(
        heading('Now'),
        text(`${current.position} · ${current.name} · ${dateRange(current.startDate, current.endDate)}`),
        text(current.summary, 'muted')
      )
      if (current.highlights.length > 0) blocks.push(list(current.highlights.map(h => [h])))
      blocks.push(blank())
    }

    const previous = previousWork(r)
    if (previous.length > 0) {
      blocks.push(
        heading('Before that'),
        kv(previous.map(w => ({
          key: dateRange(w.startDate, w.endDate),
          value: [`${w.position} · ${w.name}`]
        }))),
        blank()
      )
    }

    if (r.education.length > 0) {
      blocks.push(
        heading('Education'),
        list(r.education.map(e => {
          const line: Inline[] = [`${e.studyType} ${e.area} · ${e.institution} · ${dateRange(e.startDate, e.endDate)}`]
          if (e.score !== undefined) line.push(`(${e.score})`)
          return line
        })),
        blank()
      )
    }

    if (r.certificates.length > 0) {
      blocks.push(
        heading('Certificates'),
        list(r.certificates.map(c => [`${c.name} · ${c.issuer} · ${c.date}`])),
        blank()
      )
    }

    blocks.push(
      heading('Skills'),
      kv(r.skills.map(s => ({ key: s.name, value: [s.keywords.join(', ')] }))),
      blank(),
      kv([
        { key: 'Readable', value: [a('/resume', `${r.basics.url}/resume`)] },
        { key: 'PDF', value: [a(RESUME_PDF_PATH, `${r.basics.url}${RESUME_PDF_PATH}`)] }
      ]),
      muted(`Updated ${r.meta.lastModified}`)
    )
    return blocks
  }
}

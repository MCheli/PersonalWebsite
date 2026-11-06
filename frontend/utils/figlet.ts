/**
 * The MARK CHELI banner. Pre-formatted art is the one place the site relies
 * on fixed columns, so it is rendered in a `pre` on wide screens only; narrow
 * screens show the name as text instead (see components/Figlet.vue).
 */
export const FIGLET = String.raw`
███╗   ███╗ █████╗ ██████╗ ██╗  ██╗
████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝
██╔████╔██║███████║██████╔╝█████╔╝
██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗
██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝

 ██████╗██╗  ██╗███████╗██╗     ██╗
██╔════╝██║  ██║██╔════╝██║     ██║
██║     ███████║█████╗  ██║     ██║
██║     ██╔══██║██╔══╝  ██║     ██║
╚██████╗██║  ██║███████╗███████╗██║
 ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝`.replace(/^\n/, '')

/** Widest line of the art, in characters. */
export const FIGLET_COLUMNS = Math.max(...FIGLET.split('\n').map(line => line.length))

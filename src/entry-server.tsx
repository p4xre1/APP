import { renderToString } from "react-dom/server"
import Landing from "./marketing/Landing"

/**
 * Renders the marketing landing page to a static HTML string at *build time*.
 * Used by scripts/prerender.mjs to fill dist/index.html's #root with real
 * content, so crawlers that don't execute JavaScript (many AI/search bots)
 * see the actual page instead of an empty <div id="root"></div>.
 *
 * Deliberately renders only <Landing/> — the same component tree <App/>
 * renders for a signed-out visitor with the login form closed, which is
 * every crawler's and every first-time visitor's actual initial state.
 * The onEnter handler is a no-op here: it only matters once the client
 * hydrates and re-attaches the real handler from <App/>.
 */
export function render(): string {
  return renderToString(<Landing onEnter={() => {}} />)
}
